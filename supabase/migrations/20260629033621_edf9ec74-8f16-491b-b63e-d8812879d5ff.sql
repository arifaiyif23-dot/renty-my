-- 1. Bake production encryption key into encrypt_sensitive_data / decrypt_sensitive_data
-- (same approach used for messages — no reliance on app.settings.encryption_key)
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_key text := COALESCE(key, 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');
BEGIN
  RETURN encode(extensions.pgp_sym_encrypt(data, v_key), 'base64');
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_key text := COALESCE(key, 'r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4');
BEGIN
  RETURN extensions.pgp_sym_decrypt(decode(encrypted_data, 'base64'), v_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$function$;

-- 2. Notify owner when payout transitions to 'completed' (paid)
CREATE OR REPLACE FUNCTION public.notify_payout_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.owner_id,
      'payment_received',
      'Payout Sent',
      'RM ' || ROUND(NEW.payout_amount, 2) || ' has been transferred to your bank account.',
      '/earnings'
    );
  ELSIF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'held') THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.owner_id,
      'payment_received',
      'Payout Processing',
      'Your payout of RM ' || ROUND(NEW.payout_amount, 2) || ' is being processed.',
      '/earnings'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_payout_status_change ON public.payouts;
CREATE TRIGGER trg_notify_payout_status_change
AFTER UPDATE OF status ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.notify_payout_status_change();