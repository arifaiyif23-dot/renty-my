-- Backup encryption key to Supabase Vault (disaster recovery).
--
-- WHY: The current key lives in platform_settings (encrypted at rest by
-- Supabase, but readable by any service_role query). Vault stores it
-- in pgsodium's encrypted column — only decryptable via vault.decrypt_secret().
-- This gives us a second, independent copy that survives accidental
-- platform_settings deletion or corruption.
--
-- WHAT THIS DOES:
--   1. Reads the current key from platform_settings
--   2. Stores it in vault.secrets via vault.create_secret() (idempotent)
--   3. Creates a helper function get_encryption_key_vault() for recovery
--   4. Does NOT change encrypt/decrypt behaviour (platform_settings stays primary)
--
-- RECOVERY: If platform_settings.encryption_key is lost:
--   SELECT vault.decrypt_secret(id) FROM vault.secrets WHERE name = 'renty_encryption_key';
-- Then: UPDATE platform_settings SET value = '<decrypted>' WHERE key = 'encryption_key';

DO $$
DECLARE
  v_key TEXT;
  v_existing_id UUID;
BEGIN
  SELECT btrim(value::text, '"') INTO v_key
  FROM platform_settings WHERE key = 'encryption_key';

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'encryption_key not found in platform_settings — cannot backup';
  END IF;

  -- Check if already backed up
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'renty_encryption_key';

  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(v_key, 'renty_encryption_key', 'RENTY production encryption key — backup for disaster recovery');
    RAISE NOTICE 'encryption key backed up to Vault';
  ELSE
    -- Update existing (key may have been rotated)
    UPDATE vault.secrets SET secret = v_key WHERE id = v_existing_id;
    RAISE NOTICE 'encryption key updated in Vault (id: %)', v_existing_id;
  END IF;
END $$;

-- Step 3: Recovery helper (for manual use in SQL Editor)
CREATE OR REPLACE FUNCTION public.get_encryption_key_vault()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret RECORD;
BEGIN
  SELECT * INTO v_secret FROM vault.secrets WHERE name = 'renty_encryption_key' LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No vault backup found for renty_encryption_key';
  END IF;
  RETURN vault.decrypt_secret(v_secret.id);
END;
$$;

COMMENT ON FUNCTION public.get_encryption_key_vault() IS 'Recovery: retrieves encryption key from Vault backup. Run in SQL Editor if platform_settings.encryption_key is lost.';
