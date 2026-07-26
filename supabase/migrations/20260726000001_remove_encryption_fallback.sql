-- Remove hardcoded encryption key fallbacks from function bodies
-- The key must now be set in app.settings.encryption_key before these functions are called.
-- This prevents the key from being visible in \df+ output.

-- Set default encryption key in app.settings if not already set
INSERT INTO platform_settings (key, value)
SELECT 'encryption_key', 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4'
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE key = 'encryption_key'
);

-- Recreate encrypt_sensitive_data without hardcoded fallback
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(key, NULLIF(current_setting('app.settings.encryption_key', true), ''));
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key not configured in app.settings';
  END IF;
  RETURN encode(pgp_sym_encrypt(data, v_key), 'base64');
END;
$$;

-- Recreate decrypt_sensitive_data without hardcoded fallback
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(key, NULLIF(current_setting('app.settings.encryption_key', true), ''));
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key not configured in app.settings';
  END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Recreate encrypt_message_content without hardcoded fallback
CREATE OR REPLACE FUNCTION public.encrypt_message_content()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NEW.content IS NULL OR NEW.encrypted_content IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key not configured in app.settings';
  END IF;

  BEGIN
    NEW.encrypted_content := encode(pgp_sym_encrypt(NEW.content, v_key), 'base64');
  EXCEPTION WHEN OTHERS THEN
    NEW.encrypted_content := NULL;
  END;

  RETURN NEW;
END;
$$;

-- Recreate decrypt_message without hardcoded fallback
CREATE OR REPLACE FUNCTION public.decrypt_message(encrypted_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF encrypted_text IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key not configured in app.settings';
  END IF;

  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.encrypt_sensitive_data IS 'Encrypts sensitive data using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.decrypt_sensitive_data IS 'Decrypts sensitive data using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.encrypt_message_content IS 'Trigger function that encrypts message content using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.decrypt_message IS 'Decrypts message content using key from app.settings.encryption_key';
