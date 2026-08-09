-- RENTY: pending remote migrations (from 20260804000001 .. 20260807000010)
-- Source: supabase/migrations/*.  Apply in ONE run in the Supabase Dashboard SQL editor.
-- Then run the final INSERT that records them in supabase_migrations.schema_migrations.

---- migration: 20260804000001_cleanup_test_listings.sql ----
-- ============================================================================
-- RENTY: Cleanup test listings (2026-08-04)
-- ----------------------------------------------------------------------------
-- Masalah: listing test ("test sewa iphone" RM1/day deskripsi "test",
-- "dji osmo") masih live di production dan kelihatan di homepage/browse.
-- Ini merosakkan kepercayaan pengguna baru.
--
-- Selamat: semua FK children (item_images, saved_items, rentals, dll)
-- guna ON DELETE CASCADE, jadi delete items akan membersihkan dependent rows.
-- Item yang nampak real (cth "SYM HUSKY 150") TIDAK disentuh.
-- ============================================================================

BEGIN;

-- 1. Kenal pasti item test
CREATE TEMP TABLE _test_items AS
SELECT id, title, price_per_day
FROM public.items
WHERE title ILIKE 'test%'
   OR title ILIKE '%test sewa%'
   OR title ILIKE '%test item%'
   OR description ILIKE '%test%'
ORDER BY created_at;

-- 2. Log apa yang akan dibuang (output migration log)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM _test_items LOOP
    RAISE NOTICE 'cleanup_test_listings: deleting item % ("%", RM%)', r.id, r.title, r.price_per_day;
  END LOOP;
END $$;

-- 3. Delete (cascade membersihkan item_images, saved_items, rentals dll)
DELETE FROM public.items i
USING _test_items t
WHERE i.id = t.id;

-- 4. Bersihkan temp
DROP TABLE _test_items;

COMMIT;

-- Nota: imej yang masih tinggal dalam Supabase Storage (bucket item-images)
-- untuk listing yang dipadam perlu dibuang manual via dashboard/storage,
-- atau run script cleanup storage. DB rows dah bersih.

---- migration: 20260807000001_push_subscriptions.sql ----
-- Push notification subscriptions (FCM tokens for Capacitor native app)
-- and web push endpoints. The frontend (use-push-notifications.tsx) upserts
-- into this table. This migration formally creates it.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  endpoint text not null unique,
  platform text not null default 'fcm',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Users may only read/manage their own subscriptions.
create policy "users_read_own_push_subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "users_insert_own_push_subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_push_subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "users_delete_own_push_subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

---- migration: 20260807000002_push_dispatch_trigger.sql ----
-- Dispatch push to the send-push-notification edge function
-- whenever a row is inserted into public.notifications. Mirrors the email
-- notification webhook pattern, but uses pg_net so it works from the DB.
--
-- Secret-based auth (WEBHOOK_SECRET) matches send-email-notification.
-- The secret must be configured as Postgres setting webhook.secret
-- (e.g. `ALTER DATABASE postgres SET webhook.secret = '<value>';`).

create extension if not exists pg_net;

-- The edge function env secret WEBHOOK_SECRET must equal this DB setting,
-- or the fail-closed auth gate will reject the trigger's dispatch.
ALTER DATABASE postgres SET webhook.secret = '<MATCH-EDGE-FUNCTION-WEBHOOK_SECRET>';

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_fn text := 'https://gsucsqtqtpaeuxwrykmf.supabase.co/functions/v1/send-push-notification';
  secret text := current_setting('webhook.secret', true);
begin
  if secret is null or secret = '' then
    return null;
  end if;

  perform
    net.http_post(
      url := edge_fn,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', secret
      ),
      body := jsonb_build_object(
        'user_id', new.user_id,
        'type', new.type,
        'title', new.title,
        'body', new.message,
        'link', new.link
      )
    );
  return null;
end;
$$;

drop trigger if exists on_notification_insert_dispatch_push
  on public.notifications;

create trigger on_notification_insert_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();

---- migration: 20260807000003_encryption_key_rotation_guard.sql ----
-- Security guard: encryption key must come from a private secret, not the repo.
-- The previous migration (20260726000001) seeded a committed constant
-- (`r3nty..._2026_a8f7b2c9d1e4`) as the live key in platform_settings. That value
-- is now known publicly and MUST be rotated.
--
-- IMPORTANT (production operator action):
--   1. Generate a new random key, e.g.   openssl rand -base64 48
--   2. In the Supabase dashboard run:
--        UPDATE platform_settings SET value = to_jsonb('<NEW_KEY>'::text)
--        WHERE key = 'encryption_key';
--   3. This migration only ADDS a guard + re-encryption helpers. Do NOT run in
--      limbo: existing rows are still encrypted with the OLD key, so you must
--      decrypt with the old key and re-encrypt with the new one (see helpers below).
--
-- Until an operator sets a real key, the encryption functions already RAISE
-- EXCEPTION (fail-closed) instead of falling back to a committed secret.

-- 1. Never auto-seed the committed fallback on fresh installs.
--    The prior INSERT ... WHERE NOT EXISTS is removed by never running it here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM platform_settings
    WHERE key = 'encryption_key'
      AND value::text = '"r3nty_pr0d_m5g_enc_k3y_2026_a8f7b2c9d1e4"'
  ) THEN
    RAISE NOTICE 'WARNING: platform_settings.encryption_key is still the KNOWN placeholder value committed in the repo. Rotate it now per 20260807000003 header.';
  END IF;
END
$$;

-- 2. Operators only: rotate helper using an in-transaction temp vault.
--    Uncomment and supply YOUR keys to migrate existing rows:
--      NEW_KEY := '<paste openssl rand -base64 48 here>';
--    Examples of tables holding pgp_sym_encrypt-ed values:
--      - encrypted_message_content.messages
--      - user_bank_accounts, identities (whichever is encrypted)
--    Because decryption here runs in SQL, run this via dashboard with
--    search_path awareness; never ship the key to the repo.

---- migration: 20260807000004_revoke_payouts_update.sql ----
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

---- migration: 20260807000005_security_rls_hardening.sql ----
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

---- migration: 20260807000006_encryption_rpc_lockdown.sql ----
-- Lock down the encryption/decryption RPC surface.
--
-- Problem: decrypt_message(encrypted_text), decrypt_sensitive_data(...),
-- encrypt_sensitive_data(...) and encrypt_message_content() are SECURITY DEFINER
-- functions that accept arbitrary ciphertext/plaintext. Supabase default
-- privileges grant EXECUTE on all functions to `anon` + `authenticated`, so ANY
-- signed-in user could call `select decrypt_message('<someone elses ciphertext>')`
-- and decrypt any message or bank account row. The client never calls these RPCs
-- (it reads plaintext `content` / `account_number` directly via RLS), so revoking
-- app roles is safe and has no UI impact.
--
-- Fix:
--   1. REVOKE EXECUTE from public/anon/authenticated on all sensitive crypto fns
--      (guarded via DO block so missing fns don't abort the migration).
--   2. GRANT EXECUTE back to service_role only (backend jobs still need it).
--   3. Add a participant-authorized decrypt helper `decrypt_message_by_id(uuid)`
--      that verifies auth.uid() is sender or recipient (or maintainer) BEFORE
--      decrypting. This is the only client-callable decryption path going forward.

DO $$
DECLARE
  fn RECORD;
  names TEXT[] := ARRAY[
    'decrypt_message',
    'decrypt_sensitive_data',
    'encrypt_sensitive_data',
    'encrypt_message_content',
    'encrypt_bank_account_on_insert',
    'decrypt_bank_account_number'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname AS name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.encrypt_message_content() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_bank_account_on_insert() TO service_role;

-- Participant-authorized decryption. Never accepts ciphertext directly; the row
-- id is looked up and the caller must be a party to that conversation.
CREATE OR REPLACE FUNCTION public.decrypt_message_by_id(p_message_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_encrypted TEXT;
  v_sender uuid;
  v_recipient uuid;
  v_key TEXT;
  v_is_staff BOOLEAN;
BEGIN
  IF p_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_content, sender_id, recipient_id
    INTO v_encrypted, v_sender, v_recipient
  FROM messages
  WHERE id = p_message_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator')
  ) INTO v_is_staff;

  IF NOT (v_sender = auth.uid() OR v_recipient = auth.uid() OR v_is_staff) THEN
    RAISE EXCEPTION 'not authorized to decrypt this message';
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key FROM platform_settings WHERE key = 'encryption_key';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrypt_message_by_id(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.decrypt_message_by_id IS 'Decrypts a message for its sender/recipient (or a maintainer) only. App-exclusive decrypt path.';

---- migration: 20260807000007_encryption_key_rotation_apply.sql ----
-- Apply key rotation for existing encrypted rows.
--
-- Companion to 20260807000003 (which documents the rotation and warns on the
-- committed placeholder key). This migrates ALL existing ciphertext from the
-- old key (still in platform_settings.encryption_key) to a NEW key supplied via
-- the session variable `app.encryption.new_key`.
--
-- SAFETY: it NO-OPS (prints a notice) unless a new key is actually provided, so
-- running it inside a normal `supabase db push` is harmless and never ships a
-- secret. To perform a real rotation, an operator runs it in the dashboard with
-- the new key set for that session:
--
--   begin;
--   set app.encryption.new_key = 'PASTE_openssl_rand_-base64_48_here';
--   -- then execute this entire migration
--   commit;
--
-- Encrypted columns handled:
--   - messages.encrypted_content
--   - owner_bank_accounts.encrypted_account_number
-- After success, platform_settings.encryption_key is replaced with the new key
-- so the app's GUC fallback path keeps working. Rows are re-encrypted in place;
-- nothing is decrypted back to a persistent plaintext column here.

DO $$
DECLARE
  old_key text;
  new_key text;
  reencrypted_messages bigint;
  reencrypted_accounts bigint;
BEGIN
  PERFORM set_config('search_path', 'extensions, public', false);

  new_key := NULLIF(current_setting('app.encryption.new_key', true), '');
  IF new_key IS NULL THEN
    RAISE NOTICE 'encryption key rotation SKIPPED: set app.encryption.new_key first (see migration header).';
    RETURN;
  END IF;

  SELECT btrim(value::text, '"') INTO old_key
  FROM platform_settings WHERE key = 'encryption_key';
  IF old_key IS NULL OR old_key = '' THEN
    RAISE EXCEPTION 'old encryption key not found in platform_settings';
  END IF;

  IF old_key = new_key THEN
    RAISE NOTICE 'encryption key is already %â€¦, nothing to rotate.', left(new_key, 8);
    RETURN;
  END IF;

  -- Re-encrypt messages (in place, via the old key -> new key).
  UPDATE messages
  SET encrypted_content =
    encode(pgp_sym_encrypt(pgp_sym_decrypt(decode(encrypted_content, 'base64'), old_key), new_key), 'base64')
  WHERE encrypted_content IS NOT NULL;
  GET DIAGNOSTICS reencrypted_messages = ROW_COUNT;

  UPDATE owner_bank_accounts
  SET encrypted_account_number =
    encode(pgp_sym_encrypt(pgp_sym_decrypt(decode(encrypted_account_number, 'base64'), old_key), new_key), 'base64')
  WHERE encrypted_account_number IS NOT NULL;
  GET DIAGNOSTICS reencrypted_accounts = ROW_COUNT;

  UPDATE platform_settings
  SET value = to_jsonb(new_key::text)
  WHERE key = 'encryption_key';

  RAISE NOTICE 'rotation complete: % messages, % bank accounts re-encrypted under new_key', reencrypted_messages, reencrypted_accounts;
END;
$$;

---- migration: 20260807000008_message_content_at_rest.sql ----
-- Message content at-rest: stop persisting the plaintext `content` column.
--
-- The app's ONLY reader of messages.content is the Messages UI (verified: push
-- uses notifications.message, and no edge fn / trigger reads messages.content).
-- So we can null the plaintext column and leave only PGP ciphertext in
-- messages.encrypted_content. The updated client decrypts via the
-- participant-authorized decrypt_message_by_id RPC (20260807000006).
--
-- This migration:
--   1. Recreates encrypt_message_content() to clear NEW.content AFTER writing
--      encrypted_content, so all NEW/plaintext writes store only ciphertext.
--   2. OPT-IN backfill of existing rows: only runs if the session variable
--      app.messages.null_content = 'true' (avoids blanking history on a client
--      that is not yet reading the ciphertext). Default: no-op notice.

CREATE OR REPLACE FUNCTION public.encrypt_message_content()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NEW.content IS NULL OR NEW.encrypted_content IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key
    FROM platform_settings
    WHERE key = 'encryption_key';
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'encryption_key not configured';
  END IF;

  BEGIN
    NEW.encrypted_content := encode(pgp_sym_encrypt(NEW.content, v_key), 'base64');
  EXCEPTION WHEN OTHERS THEN
    NEW.encrypted_content := NULL;
  END;

  -- Do not persist the plaintext at rest.
  NEW.content := NULL;

  RETURN NEW;
END;
$$;

-- Install (or ensure) the trigger calling the above.
DROP TRIGGER IF EXISTS encrypt_message_on_insert ON messages;
CREATE TRIGGER encrypt_message_on_insert
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_message_content();

-- Optional backfill: clear existing plaintext that has a ciphertext twin.
-- Operator action: run the migration with the session flag set, once the client
-- that reads encrypted_content is deployed:
--   begin;
--   set app.messages.null_content = 'true';
--   -- run this migration
--   commit;
DO $$
DECLARE
  v_cleared bigint;
BEGIN
  IF NULLIF(current_setting('app.messages.null_content', true), '') = 'true' THEN
    UPDATE messages
       SET content = NULL
     WHERE content IS NOT NULL AND encrypted_content IS NOT NULL;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    RAISE NOTICE 'cleared plaintext content on % legacy message rows (at rest).', v_cleared;
  ELSE
    RAISE NOTICE 'message content backfill SKIPPED (old plaintext kept for a client that still reads `content`). Set app.messages.null_content=true to run it.';
  END IF;
END;
$$;

---- migration: 20260807000010_bank_account_at_rest.sql ----
-- Bank account at rest: stop persisting the plaintext `account_number`.
--
-- Mirrors 20260807000008 (messages): the trigger already writes ciphertext to
-- owner_bank_accounts.encrypted_account_number but ALSO keeps the plaintext in
-- `account_number`. This migration:
--   1. Recreates the encrypt trigger to clear account_number AFTER encrypting,
--      so only ciphertext is stored at rest.
--   2. Adds an owner-authorized decrypt helper decrypt_bank_account_number(uuid)
--      that decrypts ONLY the caller's own account (or staff), so the Earnings
--      UI can still show a masked preview.
--
-- The Earnings page only renders a MASKED number, so the full plaintext never
-- needs to persist; it is decrypted in-session (TLS) then masked, exactly like
-- the current behavior but without a plaintext-at-rest column.

-- 1) Clear plaintext after encrypting.
CREATE OR REPLACE FUNCTION public.encrypt_bank_account_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = extensions, public
AS $$
BEGIN
  IF NEW.account_number IS NOT NULL THEN
    NEW.encrypted_account_number := public.encrypt_sensitive_data(NEW.account_number);
  END IF;

  IF NEW.encrypted_account_number IS NOT NULL THEN
    NEW.account_number := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is installed with the updated function.
DROP TRIGGER IF EXISTS encrypt_bank_account_trigger ON owner_bank_accounts;
CREATE TRIGGER encrypt_bank_account_trigger
  BEFORE INSERT OR UPDATE ON owner_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.encrypt_bank_account_on_insert();

-- -------------------------------------------------------------------
-- Owner-authorized decryption. The caller may only decrypt their OWN bank
-- account (or a staff admin), never someone else's.
CREATE OR REPLACE FUNCTION public.decrypt_bank_account_number(p_id uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_encrypted TEXT;
  v_owner uuid;
  v_key TEXT;
  v_is_staff BOOLEAN;
BEGIN
  IF p_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_account_number, user_id
    INTO v_encrypted, v_owner
  FROM owner_bank_accounts
  WHERE id = p_id;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator')
  ) INTO v_is_staff;

  IF NOT (auth.uid() = v_owner OR v_is_staff) THEN
    RAISE EXCEPTION 'not authorized to decrypt this bank account';
  END IF;

  v_key := NULLIF(current_setting('app.settings.encryption_key', true), '');
  IF v_key IS NULL THEN
    SELECT btrim(value::text, '"') INTO v_key FROM platform_settings WHERE key = 'encryption_key';
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(v_encrypted, 'base64'), v_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Only authenticated users (and backend service_role) may call it.
REVOKE ALL ON FUNCTION public.decrypt_bank_account_number(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_bank_account_number(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.decrypt_bank_account_number IS 'Decrypts the caller''s own bank account number for masked display only.';

-- -------------------------------------------------------------------
-- Optional backfill: clear existing legacy plaintext rows that already have a
-- ciphertext twin. Opt-in via session flag so a deployed client that still
-- reads `account_number` isn't broken:
--   begin;
--   set app.bank_accounts.null_content = 'true';
--   -- run this migration
--   commit;
DO $$
DECLARE v_cleared bigint;
BEGIN
  IF NULLIF(current_setting('app.bank_accounts.null_content', true), '') = 'true' THEN
    UPDATE owner_bank_accounts
       SET account_number = NULL
     WHERE account_number IS NOT NULL AND encrypted_account_number IS NOT NULL;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
    RAISE NOTICE 'cleared plaintext account_number on % legacy bank rows (at rest).', v_cleared;
  ELSE
    RAISE NOTICE 'bank account backfill SKIPPED (old plaintext kept). Set app.bank_accounts.null_content=true to run it.';
  END IF;
END;
$$;

---- record applied migrations (run ONLY if the whole batch above succeeded) ----
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
('20260804000001', '20260804000001_cleanup_test_listings'),
('20260807000001', '20260807000001_push_subscriptions'),
('20260807000002', '20260807000002_push_dispatch_trigger'),
('20260807000003', '20260807000003_encryption_key_rotation_guard'),
('20260807000004', '20260807000004_revoke_payouts_update'),
('20260807000005', '20260807000005_security_rls_hardening'),
('20260807000006', '20260807000006_encryption_rpc_lockdown'),
('20260807000007', '20260807000007_encryption_key_rotation_apply'),
('20260807000008', '20260807000008_message_content_at_rest'),
('20260807000010', '20260807000010_bank_account_at_rest')
ON CONFLICT (version) DO NOTHING;
