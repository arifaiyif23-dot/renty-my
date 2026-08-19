-- ============================================================
-- PUTARAN KUNCI ENKRIPSI (PARAMETRIZED — TANPA KUNCI LITERAL)
-- ============================================================
-- CARA GUNA:
--   1. Set kunci baru dulu:   SET app.encryption.new_key = 'PASTE_KUNCI_BARU_ANDI_SECARA_SAFE';
--      Contoh menjana kunci baru:  SELECT encode(gen_random_bytes(48), 'base64');
--   2. Lari seluruh skrip ini dalam SATU transaksi.
--   3. Sahkan output.
--
-- PENTING (SEKURITI):
--   Skrip ini TIDAK mengandungi kunci literal. Kunci baru datang dari session
--   variable app.encryption.new_key. JANGAN pernah hardcode kunci dalam git.
--
-- Mengapa versi awal gagal:
--   1. Fungsi encrypt_sensitive_data tiada fallback ke platform_settings
--      (pgBouncer reset GUC antara statement).
--   2. Trigger bank/mesej menembak semasa UPDATE putaran.
-- ============================================================

BEGIN;

-- Sahkan kunci baru diset
DO $$
DECLARE
  v_new_key TEXT := NULLIF(current_setting('app.encryption.new_key', true), '');
BEGIN
  IF v_new_key IS NULL OR length(v_new_key) < 32 THEN
    RAISE EXCEPTION 'Kunci baru tidak diset. Lari: SET app.encryption.new_key = ''...'' dahulu';
  END IF;
  RAISE NOTICE 'Kunci baru bermula dengan: %', left(v_new_key, 8);
END;
$$;

-- ============================================================
-- A. Betulkan fungsi enkrip/denkrip (param p_key + fallback)
-- ============================================================
DROP FUNCTION IF EXISTS public.encrypt_sensitive_data(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.decrypt_sensitive_data(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data TEXT, p_key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(p_key, NULLIF(current_setting('app.settings.encryption_key', true), ''));
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key FROM platform_settings WHERE key = 'encryption_key';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'encryption_key not configured in app.settings';
  END IF;
  RETURN encode(pgp_sym_encrypt(data, v_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data TEXT, p_key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(p_key, NULLIF(current_setting('app.settings.encryption_key', true), ''));
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key FROM platform_settings WHERE key = 'encryption_key';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) TO service_role;

-- ============================================================
-- B. DROP trigger sementara
-- ============================================================
DROP TRIGGER IF EXISTS encrypt_bank_account_trigger ON owner_bank_accounts;
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON messages;

-- ============================================================
-- C. Putar kunci (kunci lama -> kunci baru)
-- ============================================================
UPDATE messages
SET encrypted_content =
  encode(
    pgp_sym_encrypt(
      pgp_sym_decrypt(
        decode(encrypted_content, 'base64'),
        (SELECT btrim(value::text, '"') FROM platform_settings WHERE key = 'encryption_key')
      ),
      current_setting('app.encryption.new_key')
    ),
    'base64'
  )
WHERE encrypted_content IS NOT NULL;

UPDATE owner_bank_accounts
SET encrypted_account_number =
  encode(
    pgp_sym_encrypt(
      pgp_sym_decrypt(
        decode(encrypted_account_number, 'base64'),
        (SELECT btrim(value::text, '"') FROM platform_settings WHERE key = 'encryption_key')
      ),
      current_setting('app.encryption.new_key')
    ),
    'base64'
  )
WHERE encrypted_account_number IS NOT NULL;

-- Kemas kini kunci dalam platform_settings
UPDATE platform_settings
SET value = to_jsonb(current_setting('app.encryption.new_key')::text)
WHERE key = 'encryption_key';

-- ============================================================
-- D. Cipta semula trigger
-- ============================================================
CREATE TRIGGER encrypt_bank_account_trigger
  BEFORE INSERT OR UPDATE ON owner_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_bank_account_on_insert();

CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_message_content();

COMMIT;

-- ============================================================
-- E. Sahkan
-- ============================================================
SELECT key, left(btrim(value::text, '"'), 8) || '...' AS preview_kunci FROM platform_settings WHERE key = 'encryption_key';
SELECT 'Mesej dienkrip semula: ' || count(*)::text AS mesej FROM messages WHERE encrypted_content IS NOT NULL;
SELECT 'Akaun bank dienkrip semula: ' || count(*)::text AS akaun FROM owner_bank_accounts WHERE encrypted_account_number IS NOT NULL;
