-- ============================================================================
--  Migration 049 - Intervallfasten-Timer (#2)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Eine Zeile = ein Fasten-Fenster (started_at + target_hours; ended_at = null solange aktiv).
--  Reines CRUD per RLS (jeder nur eigene). Streak/History werden clientseitig berechnet.
-- ============================================================================
create table if not exists public.fasting_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null default now(),
  target_hours int not null default 16 check (target_hours between 1 and 48),
  ended_at     timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists fasting_sessions_user_idx on public.fasting_sessions(user_id, started_at desc);
alter table public.fasting_sessions enable row level security;
drop policy if exists "fasting_rw_own" on public.fasting_sessions;
create policy "fasting_rw_own" on public.fasting_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
