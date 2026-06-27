
CREATE OR REPLACE FUNCTION public.check_encryption_configured()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN false;
  END IF;
  BEGIN
    k := current_setting('app.settings.encryption_key', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN k IS NOT NULL AND length(k) >= 16;
END;
$$;

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
    'encryption_configured', public.check_encryption_configured()
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_encryption_configured() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_health_stats() TO authenticated;
