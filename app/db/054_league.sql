-- ============================================================================
--  Migration 054 - Trainings-Liga (Wochen-Liga mit Auf-/Abstieg)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Konzept (wie Duolingo-Ligen): Jeder Nutzer wird pro Woche in eine Instanz
--  (week_key, tier, group_no) mit bis zu 30 echten Mitgliedern gesteckt. Punkte
--  sammelt man durch Training. Woche zu Ende -> obere 25% steigen auf, untere 25%
--  steigen ab (lazy beim naechsten Beitritt berechnet, kein Cron noetig).
--
--  Stufen (tier): 1=Bronze 2=Silber 3=Gold 4=Platin 5=Diamant.
--  Punkte ECHTER Mitglieder werden serverseitig aus den Trainings-Logs der Woche
--  berechnet (Trainingstage*25 + Saetze*3) -> faelschungssicher, Client-Werte
--  zaehlen nie. BOTS haben statische Punkte, damit die Liga auch bei wenigen
--  echten Nutzern lebendig wirkt (spaeter abschaltbar).
--  Zeitzone: Europe/Berlin (Wochenstart Montag), konsistent mit Lobby/Streak.
-- ============================================================================

create table if not exists public.league_members (
  id           uuid primary key default gen_random_uuid(),
  week_key     date not null,                                  -- Montag (Europe/Berlin)
  tier         int  not null check (tier between 1 and 5),
  group_no     int  not null default 1,                        -- Kohorte innerhalb tier+week
  user_id      uuid references auth.users(id) on delete cascade, -- null = Bot
  display_name text not null check (char_length(display_name) between 1 and 24),
  is_bot       boolean not null default false,
  bot_points   int  not null default 0,                        -- nur fuer Bots; echte: aus Logs
  joined_at    timestamptz not null default now()
);
-- Ein echter Nutzer hoechstens einmal pro Woche.
create unique index if not exists league_members_user_week
  on public.league_members(week_key, user_id) where user_id is not null;
create index if not exists league_members_instance_idx
  on public.league_members(week_key, tier, group_no);

alter table public.league_members enable row level security;
-- Bewusst KEINE permissive Policy: direkter Client-Zugriff = default deny.
-- Alles laeuft ueber die SECURITY-DEFINER-RPCs unten (umgehen RLS, kein UUID-Leak).

-- ---------------------------------------------------------------------------
-- Punkte eines echten Nutzers fuer eine Woche (Mo-So, Europe/Berlin).
-- Trainingstage * 25 + protokollierte Saetze * 3. Aus echten Logs -> faelschungssicher.
-- ---------------------------------------------------------------------------
create or replace function public._league_points(p_user uuid, p_week date)
returns int language sql security definer stable set search_path = public as $$
  with bounds as (
    select (p_week::timestamp at time zone 'Europe/Berlin')        as t0,
           ((p_week + 7)::timestamp at time zone 'Europe/Berlin')   as t1
  )
  select
    coalesce((
      select count(distinct (s.performed_at at time zone 'Europe/Berlin')::date)
      from public.workout_sessions s, bounds b
      where s.user_id = p_user and s.performed_at >= b.t0 and s.performed_at < b.t1
    ), 0) * 25
    +
    coalesce((
      select count(*)
      from public.set_logs sl, bounds b
      where sl.user_id = p_user and sl.created_at >= b.t0 and sl.created_at < b.t1
    ), 0) * 3;
$$;
revoke all on function public._league_points(uuid, date) from public, anon;

-- ---------------------------------------------------------------------------
-- Aktuelle Woche (Montag, Europe/Berlin) als Helfer.
-- ---------------------------------------------------------------------------
create or replace function public._league_week()
returns date language sql stable set search_path = public as $$
  select date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
$$;
revoke all on function public._league_week() from public, anon;

-- ---------------------------------------------------------------------------
-- Der Liga beitreten (oder Anzeigename aktualisieren). Setzt die Stufe per
-- Auf-/Abstieg aus der letzten gespielten Woche. Gibt die Stufe (1-5) zurueck.
-- ---------------------------------------------------------------------------
create or replace function public.league_join(p_display_name text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_week   date := public._league_week();
  v_name   text := coalesce(nullif(left(trim(p_display_name), 24), ''), 'Sportler');
  v_tier   int;
  v_group  int;
  v_prev   record;
  v_n      int;
  v_better int;
  v_mypts  int;
  v_cut    int;
  v_names  text[] := array['Max','Lena','Jonas','Mia','Tom','Sara','Finn','Lea','Paul','Emma','Luca','Nina','Ben','Marie','Tim','Anna','Jan','Laura','Nico','Hannah'];
  v_base   int;
  v_range  int;
begin
  -- Schon Mitglied dieser Woche? -> nur Namen aktualisieren.
  if exists (select 1 from public.league_members where week_key = v_week and user_id = auth.uid()) then
    update public.league_members set display_name = v_name
      where week_key = v_week and user_id = auth.uid()
      returning tier into v_tier;
    return v_tier;
  end if;

  -- Stufe bestimmen: letzte gespielte Woche heranziehen und Auf-/Abstieg rechnen.
  select lm.tier, lm.group_no, lm.week_key into v_prev
  from public.league_members lm
  where lm.user_id = auth.uid() and lm.week_key < v_week
  order by lm.week_key desc limit 1;

  if not found then
    v_tier := 1; -- Erstteilnahme -> Bronze
  else
    select count(*) into v_n
      from public.league_members
      where week_key = v_prev.week_key and tier = v_prev.tier and group_no = v_prev.group_no;
    v_mypts := public._league_points(auth.uid(), v_prev.week_key);
    select count(*) into v_better
      from public.league_members lm
      where lm.week_key = v_prev.week_key and lm.tier = v_prev.tier and lm.group_no = v_prev.group_no
        and (case when lm.is_bot then lm.bot_points else public._league_points(lm.user_id, v_prev.week_key) end) > v_mypts;
    v_cut := greatest(1, floor(v_n * 0.25)::int);
    if (v_better + 1) <= v_cut and v_prev.tier < 5 then
      v_tier := v_prev.tier + 1;            -- Aufstieg
    elsif (v_better + 1) > (v_n - v_cut) and v_prev.tier > 1 then
      v_tier := v_prev.tier - 1;            -- Abstieg
    else
      v_tier := v_prev.tier;                -- gehalten
    end if;
  end if;

  -- Offene Gruppe (unter 30 echten Mitgliedern) in dieser Stufe finden ...
  select group_no into v_group
  from public.league_members
  where week_key = v_week and tier = v_tier and is_bot = false
  group by group_no having count(*) < 30
  order by group_no limit 1;

  -- ... sonst neue Gruppe anlegen und mit Bots fuellen (lebendige Liga).
  if v_group is null then
    select coalesce(max(group_no), 0) + 1 into v_group
      from public.league_members where week_key = v_week and tier = v_tier;
    v_base  := case v_tier when 1 then 20 when 2 then 70 when 3 then 140 when 4 then 240 else 380 end;
    v_range := case v_tier when 1 then 100 when 2 then 150 when 3 then 200 when 4 then 260 else 350 end;
    insert into public.league_members(week_key, tier, group_no, display_name, is_bot, bot_points)
    select v_week, v_tier, v_group, nm, true, v_base + floor(random() * v_range)::int
    from (select unnest(v_names) as nm order by random() limit 9) p;
  end if;

  insert into public.league_members(week_key, tier, group_no, user_id, display_name)
  values (v_week, v_tier, v_group, auth.uid(), v_name);
  return v_tier;
end; $$;
revoke all on function public.league_join(text) from public, anon;
grant execute on function public.league_join(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rangliste der eigenen Liga-Instanz dieser Woche. Leer, wenn (noch) nicht
-- beigetreten. Gibt KEINE user_id zurueck (nur Anzeigename + is_me) -> kein Leak.
-- ---------------------------------------------------------------------------
create or replace function public.league_board()
returns table (display_name text, points int, tier int, is_me boolean, is_bot boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_week  date := public._league_week();
  v_tier  int;
  v_group int;
begin
  select lm.tier, lm.group_no into v_tier, v_group
  from public.league_members lm
  where lm.week_key = v_week and lm.user_id = auth.uid();
  if not found then return; end if;

  return query
  select m.display_name,
         (case when m.is_bot then m.bot_points else public._league_points(m.user_id, v_week) end)::int as points,
         m.tier,
         (m.user_id = auth.uid()) as is_me,
         m.is_bot
  from public.league_members m
  where m.week_key = v_week and m.tier = v_tier and m.group_no = v_group
  order by points desc, m.display_name asc;
end; $$;
revoke all on function public.league_board() from public, anon;
grant execute on function public.league_board() to authenticated;
