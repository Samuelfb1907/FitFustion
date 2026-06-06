-- ============================================================================
--  Migration 019 - Ungenutzte Tabellen entfernen
--  Im Supabase SQL Editor ausfuehren. Idempotent (DROP ... IF EXISTS).
--
--  Diese Tabellen wurden nie im App-Code verwendet: das Rezept-/automatische
--  Ernaehrungsplan-Feature wurde verworfen. Entfernen haelt Schema & DSGVO-
--  Export/Loeschung schlank. (exercise_muscles BLEIBT - Referenztabelle, wird
--  in schema.sql per Policy-Schleife genutzt.)
-- ============================================================================
drop table if exists public.recipe_items cascade;   -- Kind von recipes
drop table if exists public.recipes cascade;
drop table if exists public.meals cascade;           -- Kind von nutrition_plans
drop table if exists public.nutrition_plans cascade;
