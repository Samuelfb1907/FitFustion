-- ============================================================================
--  Migration 018 - Audit-Fixes (Juni 2026)
--  Im Supabase SQL Editor ausfuehren. Idempotent & DATENSICHER:
--  loescht KEINE Nutzerdaten - nur Fremdschluessel-Verhalten, Indizes, Policy.
--  Indizes, die wegen Altdaten nicht anlegbar sind, werden uebersprungen (NOTICE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) FK-Loeschkonflikt beheben: food_logs.food_id von RESTRICT auf CASCADE.
--    Beim Konto-Loeschen entfernt foods.user_id (cascade) die eigenen Foods;
--    deren Tagebuch-Eintraege muessen mitgeloescht werden, sonst scheitert die
--    Konto-Loeschung am RESTRICT (DSGVO Art. 17).
-- ----------------------------------------------------------------------------
alter table public.food_logs drop constraint if exists food_logs_food_id_fkey;
alter table public.food_logs
  add constraint food_logs_food_id_fkey
  foreign key (food_id) references public.foods(id) on delete cascade;

-- ----------------------------------------------------------------------------
-- 2) Fehlende Indizes auf der schreibstaerksten Tabelle (set_logs).
--    Postgres indiziert FK-Spalten NICHT automatisch -> Fortschritts-Queries
--    (.eq user_id bzw. user_id+exercise_id) liefen bisher als Seq-Scan.
-- ----------------------------------------------------------------------------
create index if not exists set_logs_user_idx on public.set_logs(user_id);
create index if not exists set_logs_user_exercise_idx on public.set_logs(user_id, exercise_id);

-- ----------------------------------------------------------------------------
-- 3) Redundante Indizes auf progress_entries entfernen.
--    progress_one_per_day (UNIQUE auf user_id, entry_date; Migration 016) deckt
--    Lookups UND Eindeutigkeit ab -> die beiden anderen sind ueberfluessig.
-- ----------------------------------------------------------------------------
drop index if exists public.progress_user_idx;
drop index if exists public.progress_user_date_idx;

-- ----------------------------------------------------------------------------
-- 4) Doppelte Saetze verhindern: set_index je (session, exercise) eindeutig.
--    Uebersprungen, falls Altdaten bereits Duplikate enthalten (NOTICE).
-- ----------------------------------------------------------------------------
do $$
begin
  create unique index if not exists set_logs_unique_set
    on public.set_logs(session_id, exercise_id, set_index);
exception when others then
  raise notice 'set_logs_unique_set uebersprungen (evtl. Altdaten-Duplikate): %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 5) foods-Lese-Policy datenschutzkonform absichern (falls 005/006 sie je wieder
--    geoeffnet haben). Globale Foods fuer alle, eigene/gescannte nur fuer Besitzer.
-- ----------------------------------------------------------------------------
drop policy if exists "foods_read_all" on public.foods;
do $$
begin
  drop policy if exists "foods_read_global_or_own" on public.foods;
  create policy "foods_read_global_or_own" on public.foods
    for select to authenticated using (user_id is null or auth.uid() = user_id);
end $$;
