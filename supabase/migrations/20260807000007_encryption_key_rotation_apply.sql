-- Apply key rotation for existing encrypted rows.
--
-- Companion to 20260807000003 (which documents the rotation and warns on the
-- committed placeholder key). This migrates ALL existing ciphertext from the
-- old key (still in platform_settings.encryption_key) to a NEW key supplied via
-- the session variable `app.encryption.new_key`.
--
-- SAFETY: it NO-OPS (prints a notice) unless a new key is actually provided, so
-- running it inside a normal `supabase db push` is harmless and never ships a
-- secret. To perform a real rotation, an operator runs it in the dashboard with
-- the new key set for that session:
--
--   begin;
--   set app.encryption.new_key = 'PASTE_openssl_rand_-base64_48_here';
--   -- then execute this entire migration
--   commit;
--
-- Encrypted columns handled:
--   - messages.encrypted_content
--   - owner_bank_accounts.encrypted_account_number
-- After success, platform_settings.encryption_key is replaced with the new key
-- so the app's GUC fallback path keeps working. Rows are re-encrypted in place;
-- nothing is decrypted back to a persistent plaintext column here.

DO $$
DECLARE
  old_key text;
  new_key text;
  reencrypted_messages bigint;
  reencrypted_accounts bigint;
BEGIN
  PERFORM set_config('search_path', 'extensions, public', false);

  new_key := NULLIF(current_setting('app.encryption.new_key', true), '');
  IF new_key IS NULL THEN
    RAISE NOTICE 'encryption key rotation SKIPPED: set app.encryption.new_key first (see migration header).';
    RETURN;
  END IF;

  SELECT btrim(value::text, '"') INTO old_key
  FROM platform_settings WHERE key = 'encryption_key';
  IF old_key IS NULL OR old_key = '' THEN
    RAISE EXCEPTION 'old encryption key not found in platform_settings';
  END IF;

  IF old_key = new_key THEN
    RAISE NOTICE 'encryption key is already %…, nothing to rotate.', left(new_key, 8);
    RETURN;
  END IF;

  -- Re-encrypt messages (in place, via the old key -> new key).
  UPDATE messages
  SET encrypted_content =
    encode(pgp_sym_encrypt(pgp_sym_decrypt(decode(encrypted_content, 'base64'), old_key), new_key), 'base64')
  WHERE encrypted_content IS NOT NULL;
  GET DIAGNOSTICS reencrypted_messages = ROW_COUNT;

  UPDATE owner_bank_accounts
  SET encrypted_account_number =
    encode(pgp_sym_encrypt(pgp_sym_decrypt(decode(encrypted_account_number, 'base64'), old_key), new_key), 'base64')
  WHERE encrypted_account_number IS NOT NULL;
  GET DIAGNOSTICS reencrypted_accounts = ROW_COUNT;

  UPDATE platform_settings
  SET value = to_jsonb(new_key::text)
  WHERE key = 'encryption_key';

  RAISE NOTICE 'rotation complete: % messages, % bank accounts re-encrypted under new_key', reencrypted_messages, reencrypted_accounts;
END;
$$;