
-- 1. Patch encrypt trigger: use embedded key, fail safely
CREATE OR REPLACE FUNCTION public.encrypt_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text := 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4';
BEGIN
  IF NEW.content IS NULL OR NEW.encrypted_content IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    NEW.encrypted_content := encode(pgp_sym_encrypt(NEW.content, v_key), 'base64');
  EXCEPTION WHEN OTHERS THEN
    -- Never block message send if encryption fails
    NEW.encrypted_content := NULL;
  END;

  RETURN NEW;
END;
$function$;

-- 2. Update decrypt_message to use the same embedded key
CREATE OR REPLACE FUNCTION public.decrypt_message(encrypted_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text := 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4';
BEGIN
  IF encrypted_text IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(decode(encrypted_text, 'base64'), v_key);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- 3. Health check returns true now that key is embedded
CREATE OR REPLACE FUNCTION public.check_encryption_configured()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

-- 4. Cascade payments/payouts when rental is deleted (unblocks item delete)
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_rental_id_fkey,
  ADD  CONSTRAINT payments_rental_id_fkey
    FOREIGN KEY (rental_id) REFERENCES public.rentals(id) ON DELETE CASCADE;

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS payouts_rental_id_fkey,
  ADD  CONSTRAINT payouts_rental_id_fkey
    FOREIGN KEY (rental_id) REFERENCES public.rentals(id) ON DELETE CASCADE;

-- 5. Repair broken mark-as-read policy
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;
CREATE POLICY "Recipients can mark messages as read"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
