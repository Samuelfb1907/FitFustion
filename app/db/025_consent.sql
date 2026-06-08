-- ============================================================================
--  Migration 025 - Server-seitiger Einwilligungs-Nachweis (DSGVO)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Speichert im Profil, welche Version des Haftungsausschlusses/Gesundheits-
--  hinweises der Nutzer akzeptiert hat und wann. Wird beim Onboarding gesetzt.
--  RLS ist bereits aktiv (profiles_*_own) -> keine zusaetzlichen Policies noetig.
-- ============================================================================
alter table public.profiles add column if not exists disclaimer_version text;
alter table public.profiles add column if not exists consented_at timestamptz;
