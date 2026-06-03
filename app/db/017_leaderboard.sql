-- ============================================================================
--  Migration 017 - Bestenliste (Leaderboard), opt-in & datenschutzfreundlich.
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Jeder Nutzer schreibt/loescht NUR seine EIGENE Zeile; LESEN duerfen alle
--  eingeloggten Nutzer (= die oeffentliche Liste). Wer nicht teilnimmt, hat
--  keine Zeile und ist damit unsichtbar. Gespeichert wird nur ein selbst
--  gewaehlter Anzeigename + aggregierte Tageszahlen (keine sensiblen Daten).
-- ============================================================================

create table if not exists public.leaderboard_entries (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  weekly_days  int not null default 0,
  monthly_days int not null default 0,
  streak       int not null default 0,
  week_key     text,   -- Montag-Datum der Woche, fuer die weekly_days gilt
  month_key    text,   -- YYYY-MM, fuer den monthly_days gilt
  updated_at   timestamptz not null default now()
);

alter table public.leaderboard_entries enable row level security;

-- Lesen: alle eingeloggten Nutzer sehen die Liste
drop policy if exists "leaderboard_read_all" on public.leaderboard_entries;
create policy "leaderboard_read_all" on public.leaderboard_entries
  for select to authenticated using (true);

-- Schreiben/Aktualisieren/Loeschen: nur die eigene Zeile
drop policy if exists "leaderboard_insert_own" on public.leaderboard_entries;
create policy "leaderboard_insert_own" on public.leaderboard_entries
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "leaderboard_update_own" on public.leaderboard_entries;
create policy "leaderboard_update_own" on public.leaderboard_entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leaderboard_delete_own" on public.leaderboard_entries;
create policy "leaderboard_delete_own" on public.leaderboard_entries
  for delete to authenticated using (auth.uid() = user_id);
