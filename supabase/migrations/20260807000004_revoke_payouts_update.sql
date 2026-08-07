-- =============================================================================
-- Harden payouts: no UPDATE grant for authenticated
--
-- payouts rows (status, amount, payout_method) are financial data that only
-- admins/service_role may alter. The original 20260701042616 grant allowed
-- authenticated UPDATE; combined with the prior "System can create payouts"
-- WITH CHECK (true) policy it represents an avoidable risk. With RLS active,
-- regular users currently have no per-row UPDATE policy, this grant is removed
-- as defense-in-depth.
-- =============================================================================

REVOKE UPDATE ON public.payouts FROM authenticated;