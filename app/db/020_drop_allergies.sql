-- ============================================================================
--  Migration 020 - Allergie-Spalte entfernen
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Die Allergie-Abfrage wurde aus dem Onboarding entfernt (Datenminimierung:
--  sensible Gesundheitsdaten ohne Verwendungszweck). Diese Migration loescht
--  die Spalte inkl. evtl. vorhandener Alt-Daten.
-- ============================================================================
alter table public.profiles drop column if exists allergies;
