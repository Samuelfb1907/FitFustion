-- ============================================================================
--  Migration 009 - Wasser-Tracking
--  Im Supabase SQL Editor ausfuehren. Idempotent.
-- ============================================================================
create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  log_date   date not null default current_date,
  amount_ml  int not null,
  created_at timestamptz not null default now()
);
create index if not exists water_logs_user_date_idx on public.water_logs(user_id, log_date);

alter table public.water_logs enable row level security;
drop policy if exists "water_logs_all_own" on public.water_logs;
create policy "water_logs_all_own" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
