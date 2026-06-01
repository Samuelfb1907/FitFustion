-- ============================================================================
--  Migration 014 - DSGVO: Recht auf Loeschung (Art. 17)
--  Erlaubt einem Nutzer, sein EIGENES Profil zu loeschen (fehlte bisher).
--  Alle anderen Nutzer-Tabellen haben bereits "for all"-Policies (Loeschen erlaubt).
--  Im Supabase SQL Editor ausfuehren. Idempotent.
-- ============================================================================
alter table public.profiles enable row level security;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);
