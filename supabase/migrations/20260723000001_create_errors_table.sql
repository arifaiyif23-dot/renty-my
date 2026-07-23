create table public.errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  error_type text not null,
  error_message text not null,
  error_stack text,
  component_stack text,
  url text,
  user_agent text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_errors_created_at on public.errors(created_at desc);
create index idx_errors_type on public.errors(error_type);
create index idx_errors_message on public.errors using gin(to_tsvector('english', error_message));

alter table public.errors enable row level security;

create policy "Anyone can insert errors"
  on public.errors for insert
  with check (true);

create policy "Admins can view errors"
  on public.errors for select
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and preferred_role in ('super_admin', 'admin')
  ));

create policy "Admins can delete errors"
  on public.errors for delete
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and preferred_role in ('super_admin', 'admin')
  ));
