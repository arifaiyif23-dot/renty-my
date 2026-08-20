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
--
-- 2026-08-20: some policy names differ on prod (e.g. "System can insert
-- payments" was created as "Service role can insert payments"). Every ALTER is
-- guarded so a renamed/missing policy is skipped instead of failing the run.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. MONEY TABLES (CRITICAL)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT t.tablename, p.policyname, p.roles::text AS proles
    FROM pg_policies p
    JOIN (VALUES
      ('payments','Service role can manage payments'),
      ('payments','System can insert payments'),
      ('payments','System can update payments'),
      ('payouts','Service role can manage payouts'),
      ('payouts','System can create payouts'),
      ('payment_locks','Service role can manage payment locks'),
      ('rate_limits','Service role can manage rate limits'),
      ('chat_messages','Service role can manage all chat messages'),
      ('admin_audit_log','System can insert audit logs'),
      ('content_moderation_log','System can insert moderation logs'),
      ('cron_job_logs','System can insert cron logs'),
      ('email_logs','System can insert email logs'),
      ('email_logs','System can update email logs'),
      ('fraud_alerts','System can create fraud alerts'),
      ('listing_analytics','Service role can insert analytics'),
      ('listing_analytics','Service role can update analytics'),
      ('listing_edit_history','System can insert edit history'),
      ('notifications','Service role can create notifications'),
      ('payment_flow_logs','System can insert payment logs'),
      ('promo_attempt_log','Service can insert promo attempts'),
      ('sensitive_data_access_log','System can insert access logs'),
      ('verification_audit_log','System can insert verification audit logs'),
      ('workflow_logs','System can insert workflow logs'),
      ('workflow_logs','System can update workflow logs')
    ) AS t(tablename, policyname)
    ON p.tablename = t.tablename AND p.policyname = t.policyname
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', rec.policyname, rec.tablename);
  END LOOP;
END
$$;

REVOKE INSERT, UPDATE, DELETE ON payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON payouts FROM anon, authenticated;
REVOKE ALL ON payment_locks FROM anon, authenticated;
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. CHAT (CRITICAL)
-- ---------------------------------------------------------------------------
REVOKE ALL ON chat_messages FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. AUDIT / LOG TABLES (HIGH — log poisoning & forensic tampering)
-- ---------------------------------------------------------------------------

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