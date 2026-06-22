-- Migration 038: ai_usage fuer den DSGVO-Export (Art. 15/20) lesbar machen.
-- Idempotent: kann mehrfach im SQL-Editor ausgefuehrt werden.
--
-- Hintergrund: public.ai_usage (Migration 027) hat RLS aktiviert, aber KEINE Policies.
-- Damit kann ein normaler authenticated-Client die Tabelle nicht lesen. Der DSGVO-Export
-- laeuft client-seitig mit dem Nutzer-Token (app/lib/gdpr.ts -> exportUserData), wuerde
-- also nichts erhalten. Diese SECURITY-DEFINER-RPC gibt dem eingeloggten Nutzer
-- ausschliesslich SEINE eigenen ai_usage-Zeilen zurueck (auth.uid()-gefiltert).

create or replace function public.export_my_ai_usage()
returns setof public.ai_usage
language sql
security definer
set search_path = public
as $$
  select * from public.ai_usage where user_id = auth.uid();
$$;

-- Ausfuehrungsrechte: nur eingeloggte Nutzer duerfen ihren eigenen Zaehler exportieren.
-- (Die Funktion filtert intern auf auth.uid(), gibt also nie fremde Daten preis.)
revoke all on function public.export_my_ai_usage() from public, anon;
grant execute on function public.export_my_ai_usage() to authenticated;
