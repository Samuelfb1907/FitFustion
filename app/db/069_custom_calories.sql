-- ============================================================================
--  Migration 069 - Manuelles Kalorienziel
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Optionales, vom Nutzer selbst gesetztes Tagesziel (kcal). NULL = automatisch
--  aus Profil/Ziel berechnen (Standard). Ist es gesetzt, ueberschreibt es die
--  Berechnung in computeNutrition (Client). RLS der profiles-Tabelle gilt bereits.
-- ============================================================================
alter table public.profiles add column if not exists custom_calories integer;

comment on column public.profiles.custom_calories is
  'Manuelles Tages-Kalorienziel des Nutzers (kcal). NULL = automatisch berechnen.';
