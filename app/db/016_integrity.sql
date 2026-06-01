-- ============================================================================
--  Migration 016 - DB-Feinschliff: Fremdschluessel-Loeschverhalten + Integritaet
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  SICHER ZUM AUSFUEHREN: Diese Migration loescht KEINE Tagebuch-/Trainings-/
--  Gewichtsdaten. Die einzige Datenaenderung ist das Deaktivieren doppelter
--  AKTIVER Ziele (das ist gewollt). Indizes, die wegen vorhandener Daten nicht
--  angelegt werden koennen, werden uebersprungen (NOTICE statt Abbruch).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Fremdschluessel: Loeschverhalten EXPLIZIT machen
-- ----------------------------------------------------------------------------
-- food_logs.food_id -> ein benutztes Lebensmittel kann nicht geloescht werden
alter table public.food_logs drop constraint if exists food_logs_food_id_fkey;
alter table public.food_logs
  add constraint food_logs_food_id_fkey
  foreign key (food_id) references public.foods(id) on delete restrict;

-- set_logs.exercise_id -> eine benutzte Uebung kann nicht geloescht werden
alter table public.set_logs drop constraint if exists set_logs_exercise_id_fkey;
alter table public.set_logs
  add constraint set_logs_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete restrict;

-- workout_plan_exercises.exercise_id -> dito
alter table public.workout_plan_exercises drop constraint if exists workout_plan_exercises_exercise_id_fkey;
alter table public.workout_plan_exercises
  add constraint workout_plan_exercises_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete restrict;

-- foods.user_id -> beim Loeschen des Nutzers dessen EIGENE Lebensmittel mitloeschen.
-- Vorher "on delete set null": geloeschte Nutzer-Lebensmittel waeren zu globalen
-- (fuer alle sichtbaren) Eintraegen geworden -> Datenschutzproblem. Jetzt: cascade.
alter table public.foods drop constraint if exists foods_user_id_fkey;
alter table public.foods
  add constraint foods_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ----------------------------------------------------------------------------
-- 2) "Genau ein aktives Ziel pro Nutzer"
-- ----------------------------------------------------------------------------
-- Erst evtl. vorhandene Mehrfach-Aktive bereinigen (das juengste bleibt aktiv) ...
update public.goals g set is_active = false
where g.is_active
  and g.id <> (
    select g2.id from public.goals g2
    where g2.user_id = g.user_id and g2.is_active
    order by g2.created_at desc
    limit 1
  );

-- ... dann per partiellem Unique-Index absichern.
do $$
begin
  create unique index if not exists goals_one_active_per_user
    on public.goals(user_id) where is_active;
exception when others then
  raise notice 'goals_one_active_per_user uebersprungen: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 3) "Hoechstens ein Gewichtseintrag pro Tag" (loescht KEINE Daten)
-- ----------------------------------------------------------------------------
do $$
begin
  create unique index if not exists progress_one_per_day
    on public.progress_entries(user_id, entry_date);
exception when others then
  raise notice 'progress_one_per_day uebersprungen (evtl. Doppel-Eintraege vorhanden): %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 4) Eindeutige Uebungsnamen (Seed-/Wiederholungssicher)
-- ----------------------------------------------------------------------------
do $$
begin
  create unique index if not exists exercises_name_uniq
    on public.exercises(name);
exception when others then
  raise notice 'exercises_name_uniq uebersprungen (evtl. doppelte Namen vorhanden): %', sqlerrm;
end $$;

-- ============================================================================
--  HINWEIS: foods.name als PARTIELLEN Unique-Index (global vs. nutzereigen)
--  ist hier bewusst NICHT enthalten - die Seeds (005/006) nutzen
--  "on conflict (name)" und braeuchten dafuer zuerst eine Anpassung.
--  -> Spaeter separat, damit Seeds wiederholbar bleiben.
-- ============================================================================
