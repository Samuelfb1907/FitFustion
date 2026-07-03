-- ============================================================================
--  Migration 059 - Cardio-Einheiten (#Cardio-Reiter)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Speichert manuell eingetragene Cardio-Einheiten (Art + Dauer + berechnete
--  kcal). Die kcal werden clientseitig nach der MET-Methode aus dem Koerper-
--  gewicht berechnet (siehe app/lib/cardio.ts) und hier nur abgelegt, damit das
--  Tagesziel im Kalorien-Tracker mitwaechst ("mehr Cardio -> mehr essen").
--  Reine JS/DB-Aenderung -> per OTA auslieferbar (kein neuer Build noetig).
-- ============================================================================

create table if not exists public.cardio_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  activity_key text not null,               -- z. B. 'treadmill', 'cycling'
  minutes      numeric(6,1) not null check (minutes > 0 and minutes <= 600),
  kcal         integer not null check (kcal >= 0),
  performed_at timestamptz not null default now()
);

create index if not exists cardio_sessions_user_idx
  on public.cardio_sessions(user_id, performed_at desc);

alter table public.cardio_sessions enable row level security;

drop policy if exists "cardio_sessions_rw_own" on public.cardio_sessions;
create policy "cardio_sessions_rw_own" on public.cardio_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
