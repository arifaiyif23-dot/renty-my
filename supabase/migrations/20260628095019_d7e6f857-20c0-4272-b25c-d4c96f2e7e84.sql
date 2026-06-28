-- Unschedule any old version of this job (ignore errors if not present)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-payments-5min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule cleanup_expired_payments() to run every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-payments-5min',
  '*/5 * * * *',
  $$SELECT public.cleanup_expired_payments();$$
);