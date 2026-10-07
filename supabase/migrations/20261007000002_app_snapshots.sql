-- Bridge for the existing Jac state while individual records are moved to
-- the normalized tables. One private snapshot per signed-in account.
create table public.app_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;
create policy app_snapshots_owner on public.app_snapshots for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
