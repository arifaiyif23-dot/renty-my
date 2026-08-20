-- ============================================================================
-- RENTY: Tighten transactions RLS (2026-08-05)
-- ----------------------------------------------------------------------------
-- Masalah: policies asal buat INSERT WITH CHECK (TRUE) dan UPDATE USING (TRUE)
-- pada public.transactions. Ini bermakna mana-mana authenticated user BOLEH
-- insert baris transactions arbitrary dan update SEBARANG row (cth tukar status
-- sendiri jadi 'paid') terus dari client — bukan sahaja admin.
--
-- Client app TIDAK menulis ke transactions (hanya admin pages baca), dan semua
-- edge function guna service_role (bypass RLS). Jadi policy TRUE ni tak guna
-- untuk app — cuma buka lubang. Selamat untuk drop.
--
-- NOTA: SELECT policy asal (peserta rental sahaja) dikekalkan.
--
-- 2026-08-20: guarded — some projects do not have a `transactions` table at
-- all; the DROP must be skipped there instead of failing the migration.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can create transactions" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "System can update transactions" ON public.transactions';
  END IF;
END
$$;

COMMIT;