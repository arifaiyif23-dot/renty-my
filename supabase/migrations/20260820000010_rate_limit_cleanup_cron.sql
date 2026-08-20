-- ============================================================================
-- B3 follow-up (2026-08-20): schedule cleanup of rate_limits.
-- check_rate_limit_track (added in 20260820000009) records every attempt in
-- rate_limits. cleanup_old_rate_limits() (7-day retention) exists but was
-- never scheduled, so the table would grow unbounded. Run it every 6h.
-- cron.schedule upserts the named job, so re-running this migration is safe.
-- ============================================================================

select cron.schedule(
  'cleanup-rate-limits',
  '0 */6 * * *',
  $$select public.cleanup_old_rate_limits();$$
);