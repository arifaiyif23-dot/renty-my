-- ============================================================================
-- RENTY: Close ALL open RLS write policies (2026-08-05) — CRITICAL SECURITY
-- ----------------------------------------------------------------------------
-- Masalah: puluhan policy bertujuan "System/Service role can X" ditulis
-- TANPA klausa `TO service_role`. Dalam PostgreSQL, policy tanpa TO terpakai
-- kepada SEMUA role (PUBLIC) — termasuk anon & authenticated. Sebab Supabase
-- default grant ALL ke anon/authenticated atas table public, mana-mana user
-- login BOLEH:
--   * payments   — baca/ubah/delete payment sesiapa (tukar status jadi paid)
--   * payouts    — cipta payout + tanda paid (WANG KELUAR)
--   * chat_messages — baca TULIS semua chat (semua pengguna)
--   * payment_locks — delete lock (buka pintu double-payment)
--   * rate_limits   — reset rate limit sendiri (buka brute-force)
--   * log tables    — poison/tamper audit trail
--
-- Fix: ALTER POLICY ... TO service_role (service_role bypass RLS, jadi edge
-- functions tak terjejas; anon/authenticated kena deny sebab tiada policy
-- terpakai) + REVOKE defense-in-depth untuk table duit/chat.
-- Client app hanya SELECT pada table berikut (disahkan dari src/), jadi
-- REVOKE write tidak memecahkan apa-apa.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. MONEY TABLES (CRITICAL)
-- ---------------------------------------------------------------------------
ALTER POLICY "Service role can manage payments" ON payments TO service_role;
ALTER POLICY "System can insert payments" ON payments TO service_role;
ALTER POLICY "System can update payments" ON payments TO service_role;
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon, authenticated;

ALTER POLICY "Service role can manage payouts" ON payouts TO service_role;
ALTER POLICY "System can create payouts" ON payouts TO service_role;
REVOKE INSERT, UPDATE, DELETE ON payouts FROM anon, authenticated;

ALTER POLICY "Service role can manage payment locks" ON payment_locks TO service_role;
REVOKE ALL ON payment_locks FROM anon, authenticated;

ALTER POLICY "Service role can manage rate limits" ON rate_limits TO service_role;
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. CHAT (CRITICAL)
-- ---------------------------------------------------------------------------
ALTER POLICY "Service role can manage all chat messages" ON chat_messages TO service_role;
REVOKE ALL ON chat_messages FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. AUDIT / LOG TABLES (HIGH — log poisoning & forensic tampering)
-- ---------------------------------------------------------------------------
ALTER POLICY "System can insert audit logs" ON admin_audit_log TO service_role;
ALTER POLICY "System can insert moderation logs" ON content_moderation_log TO service_role;
ALTER POLICY "System can insert cron logs" ON cron_job_logs TO service_role;
ALTER POLICY "System can insert email logs" ON email_logs TO service_role;
ALTER POLICY "System can update email logs" ON email_logs TO service_role;
ALTER POLICY "System can create fraud alerts" ON fraud_alerts TO service_role;
ALTER POLICY "Service role can insert analytics" ON listing_analytics TO service_role;
ALTER POLICY "Service role can update analytics" ON listing_analytics TO service_role;
ALTER POLICY "System can insert edit history" ON listing_edit_history TO service_role;
ALTER POLICY "Service role can create notifications" ON notifications TO service_role;
ALTER POLICY "System can insert payment logs" ON payment_flow_logs TO service_role;
ALTER POLICY "Service can insert promo attempts" ON promo_attempt_log TO service_role;
ALTER POLICY "System can insert access logs" ON sensitive_data_access_log TO service_role;
ALTER POLICY "System can insert verification audit logs" ON verification_audit_log TO service_role;
ALTER POLICY "System can insert workflow logs" ON workflow_logs TO service_role;
ALTER POLICY "System can update workflow logs" ON workflow_logs TO service_role;

-- ---------------------------------------------------------------------------
-- 4. platform_settings: mana-mana authenticated user BOLEH baca encryption_key,
--    ic_hash_salt & semua setting sensitif → admin + service_role sahaja.
--    (Client hanya AdminSettings baca; edge functions guna service_role.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read settings" ON platform_settings;
CREATE POLICY "Admins can read settings" ON platform_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 5. profiles: buang policy PII terbuka "Profiles viewable by authenticated
--    users" (USING true). Policy lain (self, rental participants, active item
--    owners, admins) kekal — app tak bergantung pada policy terbuka ini.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON profiles;

COMMIT;
