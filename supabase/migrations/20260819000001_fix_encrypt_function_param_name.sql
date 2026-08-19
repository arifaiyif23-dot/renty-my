-- Fix ambiguous column reference in encrypt_sensitive_data/decrypt_sensitive_data
-- The function parameter "key" shadows platform_settings.key column.
-- Must DROP first because PostgreSQL won't rename input params.
--
-- IMPORTANT: The recreated functions keep the platform_settings fallback
-- (from 20260731000001) because pgBouncer transaction pooling resets the
-- app.settings.encryption_key GUC between statements. The fallback reads the
-- key from the platform_settings TABLE (never a hardcoded literal), so it is
-- safe and always works.

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

-- Re-grant permissions (service_role is the backend-only caller)
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.encrypt_sensitive_data IS 'Encrypts sensitive data using key from app.settings.encryption_key (falls back to platform_settings).';
COMMENT ON FUNCTION public.decrypt_sensitive_data IS 'Decrypts sensitive data using key from app.settings.encryption_key (falls back to platform_settings).';
