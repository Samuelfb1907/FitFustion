-- ============================================================================
--  Migration 044 - Lobby Wochen-Wertung + Ruhmeshalle (Wochen-Sieger)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Ergaenzt die Schritte-Lobby (Migr. 042) um: (1) lobby_week_board = Schritte-Summe der
--  laufenden Woche je Mitglied (Mo-So, Europe/Berlin); (2) lobby_week_winners = erfasste
--  Wochen-Sieger; (3) lobby_hall_of_fame = finalisiert beim Aufruf die LETZTE abgeschlossene
--  Woche (lazy, ohne Cron) und gibt die Ruhmeshalle zurueck.
-- ============================================================================

create table if not exists public.lobby_week_winners (
  lobby_id     uuid not null references public.lobbies(id) on delete cascade,
  week_key     date not null,                 -- Montag der Woche (Europe/Berlin)
  user_id      uuid,                           -- Gewinner (nullable, falls Konto geloescht)
  display_name text not null,
  steps        int  not null,
  created_at   timestamptz not null default now(),
  primary key (lobby_id, week_key)
);
alter table public.lobby_week_winners enable row level security;
drop policy if exists "lobby_week_winners_select" on public.lobby_week_winners;
create policy "lobby_week_winners_select" on public.lobby_week_winners
  for select using (public.is_lobby_member(lobby_id));

-- Wochen-Rangliste (laufende Woche): Schritte-Summe Mo-So je Mitglied, meiste oben.
create or replace function public.lobby_week_board(p_lobby uuid)
returns table (display_name text, steps int, is_me boolean)
language sql security definer set search_path = public as $$
  with wk as (select date_trunc('week', (now() at time zone 'Europe/Berlin'))::date as ws)
  select m.display_name,
         coalesce(sum(ds.steps), 0)::int as steps,
         (m.user_id = auth.uid()) as is_me
  from public.lobby_members m
  left join public.daily_steps ds
    on ds.user_id = m.user_id
   and ds.day >= (select ws from wk)
   and ds.day <  (select ws from wk) + 7
  where m.lobby_id = p_lobby and public.is_lobby_member(p_lobby)
  group by m.user_id, m.display_name
  order by steps desc, m.display_name asc;
$$;
revoke all on function public.lobby_week_board(uuid) from public, anon;
grant execute on function public.lobby_week_board(uuid) to authenticated;

-- Ruhmeshalle: finalisiert (falls noch offen) die letzte abgeschlossene Woche und gibt die
-- erfassten Wochen-Sieger zurueck (neueste zuerst). Lazy -> kein Cron noetig.
create or replace function public.lobby_hall_of_fame(p_lobby uuid)
returns table (week_key date, display_name text, steps int)
language plpgsql security definer set search_path = public as $$
declare lw date;
begin
  if not public.is_lobby_member(p_lobby) then return; end if;
  lw := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date - 7; -- letzte Woche (Montag)
  insert into public.lobby_week_winners(lobby_id, week_key, user_id, display_name, steps)
  select p_lobby, lw, t.user_id, t.display_name, t.steps
  from (
    select m.user_id, m.display_name, coalesce(sum(ds.steps), 0)::int as steps
    from public.lobby_members m
    left join public.daily_steps ds
      on ds.user_id = m.user_id and ds.day >= lw and ds.day < lw + 7
    where m.lobby_id = p_lobby
    group by m.user_id, m.display_name
    order by steps desc, m.display_name asc
    limit 1
  ) t
  where t.steps > 0
  on conflict (lobby_id, week_key) do nothing;

  return query
    select w.week_key, w.display_name, w.steps
    from public.lobby_week_winners w
    where w.lobby_id = p_lobby
    order by w.week_key desc
    limit 12;
end; $$;
revoke all on function public.lobby_hall_of_fame(uuid) from public, anon;
grant execute on function public.lobby_hall_of_fame(uuid) to authenticated;
