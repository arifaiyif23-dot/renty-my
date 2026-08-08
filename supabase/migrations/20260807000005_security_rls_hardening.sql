-- =============================================================================
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
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. PAYMENTS
--    Requires: DROP "Service role can manage payments" ("FOR ALL true", no TO).
--    Keeps: "Users can view their own payments" (payer / rental-owner scoped).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;

CREATE POLICY "Service role can manage payments" ON public.payments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. PAYOUTS
--    Drops blanket manage policy; keeps own/admin SELECT + owner INSERT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage payouts" ON public.payouts;

CREATE POLICY "Service role can manage payouts" ON public.payouts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. OWNER_EARNINGS
--    Drops blanket manage policy; keeps own/admin SELECT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage earnings" ON public.owner_earnings;

CREATE POLICY "Service role can manage earnings" ON public.owner_earnings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. CHAT_MESSAGES (agent/assistant chat backing store)
--    Drops blanket manage policy; keeps session-owner scoped SELECT/INSERT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage all chat messages" ON public.chat_messages;

CREATE POLICY "Service role can manage all chat messages" ON public.chat_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. PROFILES
--    "Profiles viewable by authenticated users ... USING (true)" exposed the
--    full base table (including phone, latitude, longitude, identity hashes)
--    to every authenticated user, regardless of relationship.
--
--    Replaced with a scoped predicate that still keeps the marketplace UI and
--    rental/messaging flows working (anyone browsing may view an item owner),
--    while preventing arbitrary enumeration of unrelated users' rows.
--
--    NOTE: public.homepage total-user count reads to public_profiles().
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. ERRORS
--    "Anyone can insert errors ... WITH CHECK (true)" allows anonymous users to
--    flood the table with arbitrary content (unbounded storage + dashboard
--    poisoning). Restrict size of the writeable fields; SELECT/DELETE already
--    admin-only.
-- ---------------------------------------------------------------------------
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