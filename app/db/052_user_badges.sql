-- ============================================================================
--  Migration 052 - Monats-Challenges + Abzeichen (#68 / Folge-Feature #3)
--  Im Supabase SQL Editor ausfuehren. Idempotent. ADDITIV.
--
--  Speichert verdiente Abzeichen je Nutzer. Challenges selbst sind im Client definiert
--  (feste Monatsziele); der Fortschritt wird aus der Aktivitaet berechnet. period = 'YYYY-MM'.
-- ============================================================================
create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_key  text not null,
  period     text not null default '',           -- 'YYYY-MM' fuer Monats-Abzeichen
  earned_at  timestamptz not null default now(),
  unique (user_id, badge_key, period)
);
create index if not exists user_badges_user_idx on public.user_badges(user_id);

alter table public.user_badges enable row level security;
drop policy if exists "user_badges_rw_own" on public.user_badges;
create policy "user_badges_rw_own" on public.user_badges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
