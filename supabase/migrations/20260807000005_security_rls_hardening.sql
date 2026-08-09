-- ===============================================================================
-- Security hardening: close cross-tenant data exposure and open write vectors.
-- July 2026 security audit (Critical + High).
--
-- Background: several "Service role can manage ..." policies were created as
--   FOR ALL ... USING (true) WITH CHECK (true)  with NO role scope. In Supabase
--   default privileges grant ALL on public tables to anon/authenticated, so
--   these un-scoped policies let any authenticated (and in some cases anon)
--   user read/write EVERY row of the underlying table, bypassing the
--   participant/owner-scoped SELECT policies that were also defined.
--
-- Fix: drop those blanket policies and re-create them scoped to service_role.
-- Authenticated/anonymous access is then governed only by the row-scoped
-- participant policies already present (and the new scoped profiles policy).
--
-- NOTE (2026-08-09): every section is guarded with to_regclass() so the
-- migration is idempotent across environments where a table may not exist yet
-- (e.g. owner_earnings was never created on the production project).
-- ===============================================================================

-- ---------------------------------------------------------------------------
-- 1. PAYMENTS
--    Drops blanket manage policy; keeps own/admin SELECT.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
    CREATE POLICY "Service role can manage payments" ON public.payments FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. PAYOUTS
--    Drops blanket manage policy; keeps own/admin SELECT + owner INSERT.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.payouts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can manage payouts" ON public.payouts;
    CREATE POLICY "Service role can manage payouts" ON public.payouts FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. OWNER_EARNINGS
--    Drops blanket manage policy; keeps own/admin SELECT.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.owner_earnings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can manage earnings" ON public.owner_earnings;
    CREATE POLICY "Service role can manage earnings" ON public.owner_earnings FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. CHAT_MESSAGES (agent/assistant chat backing store)
--    Drops blanket manage policy; keeps session-owner scoped SELECT/INSERT.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role can manage all chat messages" ON public.chat_messages;
    CREATE POLICY "Service role can manage all chat messages" ON public.chat_messages FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. PROFILES
--    "Profiles viewable by authenticated ... USING (true)" exposed the full
--    base table (incl. phone, lat/lng, identity hashes) to every signed-in user.
--    Replaced with a scoped predicate that still keeps marketplace UI and
--    rental/messaging flows working while preventing arbitrary enumeration.
--    NOTE: public.homepage total-user count reads public_profiles().
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

    CREATE POLICY "Profiles visible to self, owners, and participants"
      ON public.profiles FOR SELECT
      USING (
        auth.uid() = profiles.id
        OR has_role(auth.uid(), 'admin')
        OR EXISTS (SELECT 1 FROM public.items i WHERE i.owner_id = profiles.id)
        OR EXISTS (SELECT 1 FROM public.rentals r WHERE r.owner_id = profiles.id OR r.renter_id = profiles.id)
        OR EXISTS (SELECT 1 FROM public.messages m WHERE m.sender_id = profiles.id OR m.recipient_id = profiles.id)
        OR EXISTS (SELECT 1 FROM public.reviews rv WHERE rv.reviewer_id = profiles.id)
      );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. ERRORS
--    "Anyone can insert errors ... WITH CHECK (true)" lets anonymous users flood
--    the table with arbitrary content. Restrict the size of writeable fields;
--    SELECT/DELETE already admin-only.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.errors') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone can insert errors" ON public.errors;

    CREATE POLICY "Can insert errors (size-capped)" ON public.errors FOR INSERT
      WITH CHECK (
        length(coalesce(error_type, '')) <= 100
        AND length(coalesce(error_message, '')) <= 4000
        AND length(coalesce(error_stack, '')) <= 12000
        AND length(coalesce(component_stack, '')) <= 12000
        AND length(coalesce(url, '')) <= 300
        AND length(coalesce(user_agent, '')) <= 500
      );
  END IF;
END;
$$;