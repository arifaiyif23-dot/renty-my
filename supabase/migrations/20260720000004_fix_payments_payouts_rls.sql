-- =============================================================================
-- Fix critical RLS: payments & payouts INSERT/UPDATE allowed any authenticated user
-- 
-- Root cause: Policies named "System can ..." used WITH CHECK (true) without
-- restricting to service_role, and GRANT INSERT/UPDATE was given to authenticated.
-- =============================================================================

-- ========================================
-- 1. Payments: restrict INSERT/UPDATE to service_role only
-- ========================================
DROP POLICY IF EXISTS "System can insert payments" ON public.payments;
DROP POLICY IF EXISTS "System can update payments" ON public.payments;

CREATE POLICY "Service role can insert payments"
  ON public.payments FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update payments"
  ON public.payments FOR UPDATE
  TO service_role
  USING (true);

REVOKE INSERT, UPDATE ON public.payments FROM authenticated;

-- ========================================
-- 2. Payouts: restrict INSERT to service_role only
-- ========================================
DROP POLICY IF EXISTS "System can create payouts" ON public.payouts;

CREATE POLICY "Service role can create payouts"
  ON public.payouts FOR INSERT
  TO service_role
  WITH CHECK (true);

REVOKE INSERT ON public.payouts FROM authenticated;

-- ========================================
-- 3. Reports: add SELECT policy so users can view their own reports
-- ========================================
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ========================================
-- 4. Payment flow logs: restrict SELECT to admins only
-- ========================================
DROP POLICY IF EXISTS "Admins can view payment flow logs" ON public.payment_flow_logs;
CREATE POLICY "Admins can view payment flow logs"
  ON public.payment_flow_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.payment_flow_logs FROM authenticated;
