-- Add trigger to automatically encrypt new messages using pgcrypto
-- The encrypted_content column already exists in the messages table

-- Create function to encrypt message content on insert
CREATE OR REPLACE FUNCTION public.encrypt_message_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if content is provided and encrypted_content is not already set
  IF NEW.content IS NOT NULL AND NEW.encrypted_content IS NULL THEN
    -- Store encrypted version using pgcrypto
    NEW.encrypted_content := encode(
      pgp_sym_encrypt(
        NEW.content,
        current_setting('app.settings.encryption_key', true)
      ),
      'base64'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic encryption on insert
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON public.messages;
CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_message_content();

-- Create function to decrypt message content
CREATE OR REPLACE FUNCTION public.decrypt_message(encrypted_text text)
RETURNS text AS $$
BEGIN
  IF encrypted_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(
    decode(encrypted_text, 'base64'),
    current_setting('app.settings.encryption_key', true)
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL if decryption fails (e.g., wrong key or corrupted data)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment documenting the encryption approach
COMMENT ON COLUMN public.messages.encrypted_content IS 'PGP-encrypted message content for data-at-rest protection. Decrypted using app.settings.encryption_key.';