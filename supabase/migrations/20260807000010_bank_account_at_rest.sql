-- Bank account at rest: stop persisting the plaintext `account_number`.
--
-- Mirrors 20260807000008 (messages): the trigger already writes ciphertext to
-- owner_bank_accounts.encrypted_account_number but ALSO keeps the plaintext in
-- `account_number`. This migration:
--   1. Recreates the encrypt trigger to clear account_number AFTER encrypting,
--      so only ciphertext is stored at rest.
--   2. Adds an owner-authorized decrypt helper decrypt_bank_account_number(uuid)
--      that decrypts ONLY the caller's own account (or staff), so the Earnings
--      UI can still show a masked preview.
--
-- The Earnings page only renders a MASKED number, so the full plaintext never
-- needs to persist; it is decrypted in-session (TLS) then masked, exactly like
-- the current behavior but without a plaintext-at-rest column.

-- 1) Clear plaintext after encrypting.
CREATE OR REPLACE FUNCTION public.encrypt_bank_account_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.account_number IS NOT NULL THEN
    NEW.encrypted_account_number := public.encrypt_sensitive_data(NEW.account_number);
  END IF;

  IF NEW.encrypted_account_number IS NOT NULL THEN
    NEW.account_number := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is installed with the updated function.
DROP TRIGGER IF EXISTS encrypt_bank_account_trigger ON owner_bank_accounts;
CREATE TRIGGER encrypt_bank_account_trigger
  BEFORE INSERT OR UPDATE ON owner_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_bank_account_on_insert();

-- -------------------------------------------------------------------
-- Owner-authorized decryption. The caller may only decrypt their OWN bank
-- account (or a staff admin), never someone else's.
CREATE OR REPLACE FUNCTION public.decrypt_bank_account_number(p_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_encrypted TEXT;
  v_owner uuid;
  v_key TEXT;
  v_is_staff BOOLEAN;
BEGIN
  IF p_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_account_number, user_id
    INTO v_encrypted, v_owner
  FROM owner_bank_accounts
  WHERE id = p_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator')
  ) INTO v_is_staff;

  IF NOT (auth.uid() = v_owner OR v_is_staff) THEN
    RAISE EXCEPTION 'not authorized to decrypt this bank account';
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key FROM platform_settings WHERE key = 'encryption_key';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Only authenticated users (and backend service_role) may call it.
REVOKE ALL ON FUNCTION public.decrypt_bank_account_number(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_bank_account_number(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.decrypt_bank_account_number IS 'Decrypts the caller''s own bank account number for masked display only.';

-- -------------------------------------------------------------------
-- Optional backfill: clear existing legacy plaintext rows that already have a
-- ciphertext twin. Opt-in via session flag so a deployed client that still
-- reads `account_number` isn't broken:
--   begin;
--   set app.bank_accounts.null_content = 'true';
--   -- run this migration
--   commit;
DO $$
DECLARE v_cleared bigint;
BEGIN
  IF NULLIF(current_setting('app.bank_accounts.null_content', true), '') = 'true' THEN
    UPDATE owner_bank_accounts
       SET account_number = NULL
     WHERE account_number IS NOT NULL AND encrypted_account_number IS NOT NULL;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    RAISE NOTICE 'cleared plaintext account_number on % legacy bank rows (at rest).', v_cleared;
  ELSE
    RAISE NOTICE 'bank account backfill SKIPPED (old plaintext kept). Set app.bank_accounts.null_content=true to run it.';
  END IF;
END;
$$;