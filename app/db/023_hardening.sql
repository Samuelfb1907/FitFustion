-- ============================================================================
--  Migration 023 - Haertung (Audit 2026-06)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Enthaelt:
--   A) Leaderboard: fremde Auth-UUIDs nicht mehr direkt abfragbar
--      (Basistabelle nur noch eigene Zeile lesbar; oeffentliche Liste laeuft
--       ueber eine SECURITY-DEFINER-View, die KEINE user_id herausgibt).
--   B) Leaderboard: Laengen-/Wertegrenzen fuer display_name und Punkte.
--   C) Bereichs-CHECKs gegen manipulierte Client-Werte auf foods, food_logs,
--      water_logs, set_logs, progress_entries, profiles, meal_favorites.
--
--  Alle Daten-CHECKs sind NOT VALID -> sie gelten ab sofort fuer NEUE/geaenderte
--  Zeilen, brechen aber bestehende Daten nicht. Spaeter optional "VALIDATE
--  CONSTRAINT" nachziehen, sobald Altdaten geprueft sind.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Leaderboard: Basistabelle nur eigene Zeile lesbar (UUID-Leak schliessen)
-- ---------------------------------------------------------------------------
-- Vorher: "leaderboard_read_all USING(true)" -> jeder eingeloggte Nutzer konnte
-- per Direktabfrage die user_id (Auth-UUID) ALLER Teilnehmer lesen.
drop policy if exists "leaderboard_read_all" on public.leaderboard_entries;
drop policy if exists "leaderboard_read_own" on public.leaderboard_entries;
create policy "leaderboard_read_own" on public.leaderboard_entries
  for select to authenticated using (auth.uid() = user_id);

-- Oeffentliche Liste: SECURITY-DEFINER-View (laeuft als Eigentuemer, sieht alle
-- Zeilen) - gibt aber NUR Anzeige-Daten + is_me heraus, NIE die user_id.
-- (Bewusst OHNE security_invoker; Supabase-Linter darf das als
--  "security definer view" anmerken - hier ist es Absicht.)
drop view if exists public.leaderboard_public;
create view public.leaderboard_public as
select
  display_name,
  weekly_days,
  monthly_days,
  streak,
  week_key,
  month_key,
  (user_id = auth.uid()) as is_me
from public.leaderboard_entries;
grant select on public.leaderboard_public to authenticated;

-- ---------------------------------------------------------------------------
-- B) Leaderboard: Anzeigename-Laenge + Punkte-Grenzen (Anti-Abuse, Defense)
--    (verhindert absurde Werte/Strings bei direktem API-Zugriff;
--     die saubere Loesung - serverseitig berechnete Punkte - bleibt ein
--     spaeteres To-do, siehe Audit H1)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_display_name_len') then
    alter table public.leaderboard_entries add constraint leaderboard_display_name_len
      check (char_length(display_name) between 1 and 24) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_score_bounds') then
    alter table public.leaderboard_entries add constraint leaderboard_score_bounds
      check (weekly_days between 0 and 7 and monthly_days between 0 and 31 and streak between 0 and 3660) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- C) Bereichs-CHECKs gegen manipulierte Client-Werte
-- ---------------------------------------------------------------------------
do $$
begin
  -- foods: sinnvolle Naehrwert-Obergrenzen + Namenslaenge
  if not exists (select 1 from pg_constraint where conname = 'foods_sane_values') then
    alter table public.foods add constraint foods_sane_values
      check (kcal >= 0 and kcal <= 1000
             and protein >= 0 and protein <= 100
             and carbs   >= 0 and carbs   <= 100
             and fat     >= 0 and fat     <= 100
             and char_length(name) <= 200) not valid;
  end if;

  -- food_logs: Menge in Gramm > 0 und nicht absurd gross
  if not exists (select 1 from pg_constraint where conname = 'food_logs_amount_sane') then
    alter table public.food_logs add constraint food_logs_amount_sane
      check (amount_g > 0 and amount_g <= 100000) not valid;
  end if;

  -- water_logs: ml > 0 und <= 20 Liter
  if not exists (select 1 from pg_constraint where conname = 'water_logs_amount_sane') then
    alter table public.water_logs add constraint water_logs_amount_sane
      check (amount_ml > 0 and amount_ml <= 20000) not valid;
  end if;

  -- set_logs: Wiederholungen/Gewicht/Index in plausiblen Grenzen (Spalten nullbar)
  if not exists (select 1 from pg_constraint where conname = 'set_logs_sane') then
    alter table public.set_logs add constraint set_logs_sane
      check ((reps is null or (reps >= 0 and reps <= 1000))
             and (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000))
             and (duration_seconds is null or duration_seconds >= 0)
             and set_index >= 1) not valid;
  end if;

  -- progress_entries: Gewicht plausibel
  if not exists (select 1 from pg_constraint where conname = 'progress_weight_sane') then
    alter table public.progress_entries add constraint progress_weight_sane
      check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 500)) not valid;
  end if;

  -- profiles: Gewicht/Groesse/Geburtsdatum plausibel
  if not exists (select 1 from pg_constraint where conname = 'profiles_sane_ranges') then
    alter table public.profiles add constraint profiles_sane_ranges
      check ((weight_kg is null or (weight_kg >= 20 and weight_kg <= 500))
             and (height_cm is null or (height_cm >= 50 and height_cm <= 300))
             and (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date))) not valid;
  end if;

  -- meal_favorites: items muss ein Array sein, begrenzte Anzahl + Groesse
  if not exists (select 1 from pg_constraint where conname = 'meal_favorites_items_sane') then
    alter table public.meal_favorites add constraint meal_favorites_items_sane
      check (jsonb_typeof(items) = 'array'
             and jsonb_array_length(items) <= 50
             and pg_column_size(items) <= 65536) not valid;
  end if;
end $$;
