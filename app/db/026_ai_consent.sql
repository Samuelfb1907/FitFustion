-- ============================================================================
--  Migration 026 - Einwilligung zur KI-Mahlzeitenerkennung (Art. 9 DSGVO)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Speichert, WANN der Nutzer der Uebermittlung des Mahlzeiten-Freitexts an den
--  Auftragsverarbeiter Anthropic (USA) zugestimmt hat. NULL = keine Einwilligung
--  (bzw. widerrufen). RLS ist ueber profiles_*_own bereits aktiv.
-- ============================================================================
alter table public.profiles add column if not exists ai_consent_at timestamptz;
