-- ============================================================================
--  Migration 002 – Allergien zum Profil hinzufügen
--  Im Supabase SQL Editor ausführen (New query -> einfügen -> Run).
--  "if not exists" + Standardwert '{}' => sicher & mehrfach ausführbar.
-- ============================================================================
alter table public.profiles
  add column if not exists allergies text[] not null default '{}';
