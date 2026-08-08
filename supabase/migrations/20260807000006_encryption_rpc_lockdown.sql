-- Lock down the encryption/decryption RPC surface.
--
-- Problem: decrypt_message(encrypted_text), decrypt_sensitive_data(...),
-- encrypt_sensitive_data(...) and encrypt_message_content() are SECURITY DEFINER
-- functions that accept arbitrary ciphertext/plaintext. Supabase default
-- privileges grant EXECUTE on all functions to `anon` + `authenticated`, so ANY
-- signed-in user could call `select decrypt_message('<someone elses ciphertext>')`
-- and decrypt any message or bank account row. The client never calls these RPCs
-- (it reads plaintext `content` / `account_number` directly via RLS), so revoking
-- app roles is safe and has no UI impact.
--
-- Fix:
--   1. REVOKE EXECUTE from public/anon/authenticated on all sensitive crypto fns
--      (guarded via DO block so missing fns don't abort the migration).
--   2. GRANT EXECUTE back to service_role only (backend jobs still need it).
--   3. Add a participant-authorized decrypt helper `decrypt_message_by_id(uuid)`
--      that verifies auth.uid() is sender or recipient (or maintainer) BEFORE
--      decrypting. This is the only client-callable decryption path going forward.

DO $$
DECLARE
  fn RECORD;
  names TEXT[] := ARRAY[
    'decrypt_message',
    'decrypt_sensitive_data',
    'encrypt_sensitive_data',
    'encrypt_message_content',
    'encrypt_bank_account_on_insert',
    'decrypt_bank_account_number'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_message_content() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_bank_account_on_insert() TO service_role;

-- Participant-authorized decryption. Never accepts ciphertext directly; the row
-- id is looked up and the caller must be a party to that conversation.
CREATE OR REPLACE FUNCTION public.decrypt_message_by_id(p_message_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_encrypted TEXT;
  v_sender uuid;
  v_recipient uuid;
  v_key TEXT;
  v_is_staff BOOLEAN;
BEGIN
  IF p_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_content, sender_id, recipient_id
    INTO v_encrypted, v_sender, v_recipient
  FROM messages
  WHERE id = p_message_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator')
  ) INTO v_is_staff;

  IF NOT (v_sender = auth.uid() OR v_recipient = auth.uid() OR v_is_staff) THEN
    RAISE EXCEPTION 'not authorized to decrypt this message';
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

GRANT EXECUTE ON FUNCTION public.decrypt_message_by_id(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.decrypt_message_by_id IS 'Decrypts a message for its sender/recipient (or a maintainer) only. App-exclusive decrypt path.';
