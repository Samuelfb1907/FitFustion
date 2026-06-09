-- Migration 027: Tageslimit fuer KI-Analysen (Schutz vor Kostenexplosion / Denial-of-Wallet)
-- Idempotent: kann mehrfach im SQL-Editor ausgefuehrt werden.
--
-- Die Edge Function parse-meal ruft bump_ai_usage(p_user, p_limit) auf.
-- Die Funktion zaehlt die heutigen Aufrufe des Nutzers hoch und meldet, ob er
-- noch unter dem Limit liegt. Die Tabelle ist nur ueber die Service-Role
-- (serverseitig in der Edge Function) erreichbar - kein Client-Zugriff.

-- 1) Nutzungs-Zaehler pro Nutzer und Tag
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count      integer not null default 0,
  primary key (user_id, usage_date)
);

-- RLS an, aber KEINE Policies -> normale Nutzer (anon/authenticated) kommen nicht heran.
-- Nur die Service-Role (Edge Function) und SECURITY-DEFINER-Funktionen umgehen RLS.
alter table public.ai_usage enable row level security;

-- 2) Atomar hochzaehlen + pruefen. Gibt true zurueck, solange der Nutzer im Limit ist.
create or replace function public.bump_ai_usage(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.ai_usage (user_id, usage_date, count)
  values (p_user, current_date, 1)
  on conflict (user_id, usage_date)
  do update set count = public.ai_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Ausfuehrungsrechte: nur Service-Role darf die Funktion direkt aufrufen.
revoke all on function public.bump_ai_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, integer) to service_role;
