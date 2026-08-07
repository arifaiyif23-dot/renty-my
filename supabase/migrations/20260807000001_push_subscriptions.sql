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