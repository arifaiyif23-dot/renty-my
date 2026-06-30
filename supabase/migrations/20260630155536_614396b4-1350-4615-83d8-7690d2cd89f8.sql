
-- 1. Encryption self-test: encrypt -> decrypt round trip
CREATE OR REPLACE FUNCTION public.encryption_self_test()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sample text := 'renty_health_check_' || extract(epoch from now())::text;
  v_encrypted text;
  v_decrypted text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;
  v_encrypted := public.encrypt_sensitive_data(v_sample);
  v_decrypted := public.decrypt_sensitive_data(v_encrypted);
  RETURN v_decrypted = v_sample;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- 2. Extend system health stats with pgcrypto + self-test
CREATE OR REPLACE FUNCTION public.get_system_health_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  payments_today int;
  payments_paid_today int;
  expired_pending int;
  payouts_held int;
  payouts_pending int;
  payouts_awaiting_bank int;
  emails_today int;
  emails_delivered_today int;
  emails_bounced_today int;
  last_payment_log timestamptz;
  pgcrypto_ok boolean;
  enc_self_test boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COUNT(*) INTO payments_today FROM payments WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO payments_paid_today FROM payments WHERE status = 'paid' AND updated_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO expired_pending FROM payments WHERE status = 'pending' AND expires_at < NOW();
  SELECT COUNT(*) INTO payouts_held FROM payouts WHERE status = 'held';
  SELECT COUNT(*) INTO payouts_pending FROM payouts WHERE status = 'pending';
  SELECT COUNT(*) INTO payouts_awaiting_bank FROM payouts WHERE status = 'awaiting_bank_details';
  SELECT COUNT(*) INTO emails_today FROM email_logs WHERE created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO emails_delivered_today FROM email_logs WHERE status IN ('delivered','opened','clicked') AND created_at::date = CURRENT_DATE;
  SELECT COUNT(*) INTO emails_bounced_today FROM email_logs WHERE status IN ('bounced','complained','failed') AND created_at::date = CURRENT_DATE;
  SELECT MAX(created_at) INTO last_payment_log FROM payment_flow_logs;

  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') INTO pgcrypto_ok;
  SELECT public.encryption_self_test() INTO enc_self_test;

  result := jsonb_build_object(
    'payments_today', payments_today,
    'payments_paid_today', payments_paid_today,
    'expired_pending', expired_pending,
    'payouts_held', payouts_held,
    'payouts_pending', payouts_pending,
    'payouts_awaiting_bank', payouts_awaiting_bank,
    'emails_today', emails_today,
    'emails_delivered_today', emails_delivered_today,
    'emails_bounced_today', emails_bounced_today,
    'last_payment_log', last_payment_log,
    'encryption_configured', public.check_encryption_configured(),
    'pgcrypto_installed', pgcrypto_ok,
    'encryption_self_test', enc_self_test
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encryption_self_test() TO authenticated;
