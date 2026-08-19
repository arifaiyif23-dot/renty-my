-- ============================================================================
-- RENTY: Close remaining open RLS policies missed by 20260805000002 (2026-08-06)
-- ----------------------------------------------------------------------------
-- Penemuan audit mamat (gelombang 2):
--   1. payment_audit_log — policy "Service role can insert audit logs"
--      (FOR INSERT WITH CHECK(true)) ditulis TANPA `TO service_role` →
--      mana-mana authenticated user boleh poison audit trail payment.
--      Fix: TO service_role + REVOKE write dari anon/authenticated.
--      (SELECT untuk admin kekal — "Admins can view audit logs" guna
--       has_role, sebab itu REVOKE hanya INSERT/UPDATE/DELETE.)
--   2. receipts bucket — policy "System can insert receipts" ON storage.objects
--      TANPA `TO service_role` → sesiapa boleh upload fail ke bucket receipts
--      (abuse storage + kos). Bucket receipts dah tak digunakan oleh
--      generate-signed-url (dibuang), tapi policy masih hidup.
--      Fix: TO service_role. Tiada REVOKE storage.objects global — user masih
--      perlu upload avatar/gambar listing ke bucket lain.
-- ============================================================================

BEGIN;

ALTER POLICY "Service role can insert audit logs" ON payment_audit_log TO service_role;
REVOKE INSERT, UPDATE, DELETE ON payment_audit_log FROM anon, authenticated;

ALTER POLICY "System can insert receipts" ON storage.objects TO service_role;

COMMIT;
