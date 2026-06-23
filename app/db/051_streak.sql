-- ============================================================================
--  Migration 051 - Streak-System (#46 / Folge-Feature #2)
--  Im Supabase SQL Editor ausfuehren. Idempotent. ADDITIV (nur neue Spalten + RPC).
--
--  Persistenter Streak (ueberlebt Reinstall/Geraetewechsel) + automatischer Freeze:
--  1 Freeze-Token je ISO-Woche ueberbrueckt GENAU EINEN Fehltag, damit die Serie
--  nicht bei einem einzigen verpassten Tag reisst.
-- ============================================================================
alter table public.profiles
  add column if not exists streak_current int not null default 0,
  add column if not exists streak_best int not null default 0,
  add column if not exists streak_last_day date,
  add column if not exists streak_freeze_tokens int not null default 0,
  add column if not exists streak_freeze_week date;

-- Zaehlt den heutigen aktiven Tag. Der Client ruft die Funktion auf, WENN heute
-- Aktivitaet vorliegt (Training/Tracker). p_today = lokales Datum des Clients
-- (zeitzonensicher). p_seed = clientseitig berechneter Streak (nur beim ALLERERSTEN
-- Aufruf genutzt, damit Bestandsnutzer nicht bei 1 anfangen). Gibt neuen Stand +
-- neu erreichten Meilenstein (3/7/30/100) + ob ein Freeze genutzt wurde zurueck.
create or replace function public.touch_streak(p_today date, p_seed int default 0)
returns table(streak int, best int, freeze_tokens int, milestone int, freeze_used boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur int; bst int; last date; tokens int; fweek date;
  this_mon date := (p_today - (extract(isodow from p_today)::int - 1))::date;
  old_streak int;
  used boolean := false;
  ms int := 0;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_today is null then raise exception 'date required'; end if;

  select streak_current, streak_best, streak_last_day, streak_freeze_tokens, streak_freeze_week
    into cur, bst, last, tokens, fweek
    from public.profiles where id = uid for update;
  cur := coalesce(cur, 0); bst := coalesce(bst, 0); tokens := coalesce(tokens, 0);

  -- Neue ISO-Woche -> 1 frisches Freeze-Token (wird nicht gehortet).
  if fweek is null or fweek < this_mon then
    tokens := 1;
    fweek := this_mon;
  end if;

  old_streak := cur;
  if last is null then
    cur := greatest(1, coalesce(p_seed, 0));             -- erster Aufruf: aus Historie seeden
  elsif (p_today - last) >= 3 then
    cur := 1;                                            -- gerissen (>=2 Fehltage)
  elsif p_today = last then
    null;                                                -- heute schon gezaehlt
  elsif (p_today - last) = 1 then
    cur := cur + 1;                                      -- direkt am Folgetag
  elsif (p_today - last) = 2 and tokens > 0 then
    tokens := tokens - 1; used := true; cur := cur + 1;  -- 1 Fehltag eingefroren
  else
    cur := 1;                                            -- 1 Fehltag, kein Token -> gerissen
  end if;

  if cur > bst then bst := cur; end if;

  ms := case
    when last is null then 0                             -- Seeding: nicht feiern
    when old_streak < 100 and cur >= 100 then 100
    when old_streak < 30  and cur >= 30  then 30
    when old_streak < 7   and cur >= 7   then 7
    when old_streak < 3   and cur >= 3   then 3
    else 0 end;

  update public.profiles
    set streak_current = cur, streak_best = bst, streak_last_day = p_today,
        streak_freeze_tokens = tokens, streak_freeze_week = fweek
    where id = uid;

  return query select cur, bst, tokens, ms, used;
end;
$$;

revoke all on function public.touch_streak(date, int) from public;
grant execute on function public.touch_streak(date, int) to authenticated;
