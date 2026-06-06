-- ============================================================================
--  Migration 021 - Leaderboard-View ohne fremde UUIDs (Datenminimierung)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Bisher las der Client leaderboard_entries direkt und bekam die user_id (UUID)
--  ALLER Teilnehmer. Diese View liefert stattdessen nur die Anzeige-Daten plus
--  ein is_me-Flag - fremde UUIDs verlassen die Datenbank nicht mehr.
--  security_invoker = on -> die RLS von leaderboard_entries (Lesen fuer alle
--  eingeloggten Nutzer) gilt weiterhin.
-- ============================================================================
create or replace view public.leaderboard_public
with (security_invoker = on) as
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
