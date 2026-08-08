-- Message content at-rest: stop persisting the plaintext `content` column.
--
-- The app's ONLY reader of messages.content is the Messages UI (verified: push
-- uses notifications.message, and no edge fn / trigger reads messages.content).
-- So we can null the plaintext column and leave only PGP ciphertext in
-- messages.encrypted_content. The updated client decrypts via the
-- participant-authorized decrypt_message_by_id RPC (20260807000006).
--
-- This migration:
--   1. Recreates encrypt_message_content() to clear NEW.content AFTER writing
--      encrypted_content, so all NEW/plaintext writes store only ciphertext.
--   2. OPT-IN backfill of existing rows: only runs if the session variable
--      app.messages.null_content = 'true' (avoids blanking history on a client
--      that is not yet reading the ciphertext). Default: no-op notice.

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
    SELECT btrim(value::text, '"') INTO v_key
    FROM platform_settings
    WHERE key = 'encryption_key';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'encryption_key not configured';
  END IF;

  BEGIN
    NEW.encrypted_content := encode(pgp_sym_encrypt(NEW.content, v_key), 'base64');
  EXCEPTION WHEN OTHERS THEN
    NEW.encrypted_content := NULL;
  END;

  -- Do not persist the plaintext at rest.
  NEW.content := NULL;

  RETURN NEW;
END;
$$;

-- Install (or ensure) the trigger calling the above.
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON messages;
CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_message_content();

-- Optional backfill: clear existing plaintext that has a ciphertext twin.
-- Operator action: run the migration with the session flag set, once the client
-- that reads encrypted_content is deployed:
--   begin;
--   set app.messages.null_content = 'true';
--   -- run this migration
--   commit;
DO $$
DECLARE
  v_cleared bigint;
BEGIN
  IF NULLIF(current_setting('app.messages.null_content', true), '') = 'true' THEN
    UPDATE messages
       SET content = NULL
     WHERE content IS NOT NULL AND encrypted_content IS NOT NULL;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    RAISE NOTICE 'cleared plaintext content on % legacy message rows (at rest).', v_cleared;
  ELSE
    RAISE NOTICE 'message content backfill SKIPPED (old plaintext kept for a client that still reads `content`). Set app.messages.null_content=true to run it.';
  END IF;
END;
$$;