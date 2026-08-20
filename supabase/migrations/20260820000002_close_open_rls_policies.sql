-- ============================================================================
-- Fasa A (Audit 2026-08-19): close 8 open RLS policies.
--
-- The following tables were created with "System can ..." policies that have
-- NO `TO role` clause, so they apply to `public` (anon + authenticated). Any
-- visitor could forge financial/audit rows (deposits, refunds, penalties,
-- damage claims, booking_events, item_status_history, payment_processing_log).
--
-- Fix: drop the open policies, recreate them scoped to service_role only, and
-- REVOKE INSERT/UPDATE/DELETE on those tables from anon + authenticated.
-- SELECT policies (participant/admin views) are left untouched.
-- ============================================================================

-- NOTE: payment_flow_logs' "System can insert payment logs" is already closed
-- by 20260805000002. These 7 tables are the ones still open.

DO $$
BEGIN
  DROP POLICY IF EXISTS "System can manage deposits" ON public.deposits;
  DROP POLICY IF EXISTS "System can manage refunds" ON public.refunds;
  DROP POLICY IF EXISTS "System can manage late return records" ON public.late_return_records;
  DROP POLICY IF EXISTS "System can manage penalty records" ON public.penalty_records;
  DROP POLICY IF EXISTS "System can manage damage claims" ON public.damage_claims;
  DROP POLICY IF EXISTS "System can insert booking events" ON public.booking_events;
  DROP POLICY IF EXISTS "System can insert status history" ON public.item_status_history;
END
$$;

CREATE POLICY "System can manage deposits" ON public.deposits
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "System can manage refunds" ON public.refunds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "System can manage late return records" ON public.late_return_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "System can manage penalty records" ON public.penalty_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "System can manage damage claims" ON public.damage_claims
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "System can insert booking events" ON public.booking_events
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "System can insert status history" ON public.item_status_history
  FOR INSERT TO service_role WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON
  public.deposits,
  public.refunds,
  public.late_return_records,
  public.penalty_records,
  public.damage_claims,
  public.booking_events,
  public.item_status_history
FROM anon, authenticated;
