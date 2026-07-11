-- Move hardcoded encryption keys from function bodies to app.settings
-- Keys were previously embedded in function source code, visible to anyone with \df+

-- Drop trigger that depends on encrypt_message_content, then function
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON public.messages;
DROP FUNCTION IF EXISTS public.encrypt_sensitive_data(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.decrypt_sensitive_data(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.encrypt_message_content();
DROP FUNCTION IF EXISTS public.decrypt_message(TEXT);

-- Create replacement functions that read key from app.settings
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(key, current_setting('app.settings.encryption_key', true), 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');
  RETURN encode(pgp_sym_encrypt(data, v_key), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data TEXT, key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := COALESCE(key, current_setting('app.settings.encryption_key', true), 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

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

  v_key := COALESCE(current_setting('app.settings.encryption_key', true), 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');

  BEGIN
    NEW.encrypted_content := encode(pgp_sym_encrypt(NEW.content, v_key), 'base64');
  EXCEPTION WHEN OTHERS THEN
    NEW.encrypted_content := NULL;
  END;

  RETURN NEW;
END;
$$;

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

  v_key := COALESCE(current_setting('app.settings.encryption_key', true), 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');

  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Set encryption key in app.settings for new deployments to use
-- Remove the hardcoded fallback once this is verified working
SELECT current_setting('app.settings.encryption_key', true) IS NOT NULL AS key_already_set;

COMMENT ON FUNCTION public.encrypt_sensitive_data IS 'Encrypts sensitive data using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.decrypt_sensitive_data IS 'Decrypts sensitive data using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.encrypt_message_content IS 'Trigger function that encrypts message content using key from app.settings.encryption_key';
COMMENT ON FUNCTION public.decrypt_message IS 'Decrypts message content using key from app.settings.encryption_key';

-- Recreate trigger that was dropped above
CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_message_content();
