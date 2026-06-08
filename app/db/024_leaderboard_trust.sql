-- ============================================================================
--  Migration 024 - Leaderboard fälschungssicher + Mengen-Limits (Audit H1 / Abuse)
--  Im Supabase SQL Editor ausführen. Idempotent.
--
--  A) Leaderboard-Punkte (weekly_days/monthly_days/streak/week_key/month_key)
--     werden ab jetzt SERVERSEITIG per BEFORE-Trigger aus den EIGENEN Logs des
--     Nutzers berechnet. Vom Client gesendete Werte werden ignoriert/überschrieben
--     -> niemand kann sich per Direkt-API auf Platz 1 setzen. Der Anzeigename
--     bleibt frei wählbar (durch die CHECKs aus 023 begrenzt).
--  B) Großzügige Mengen-Limits (Anti-Runaway) für meal_favorites & eigene foods.
--
--  Zeitzone: Europe/Berlin (App-Zielgruppe), damit Tagesgrenzen ~ Gerät passen.
--  Streak-Logik 1:1 aus app/lib/gamification.ts (1 Tag Karenz).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Leaderboard: Punkte serverseitig berechnen
-- ---------------------------------------------------------------------------
create or replace function public._leaderboard_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today  date := (now() at time zone 'Europe/Berlin')::date;
  v_monday date := (now() at time zone 'Europe/Berlin')::date
                   - (extract(isodow from (now() at time zone 'Europe/Berlin')::date)::int - 1);
  v_days   date[];
  v_weekly int;
  v_monthly int;
  v_streak int := 0;
  v_cursor date;
begin
  -- Aktive Tage (Essens-Eintrag ODER Training) der letzten ~400 Tage, je 1x.
  select array_agg(distinct d) into v_days from (
    select log_date::date as d
      from public.food_logs
     where user_id = NEW.user_id and log_date >= v_today - 400
    union
    select (performed_at at time zone 'Europe/Berlin')::date as d
      from public.workout_sessions
     where user_id = NEW.user_id and performed_at >= (v_today - 400)::timestamptz
  ) s;
  v_days := coalesce(v_days, array[]::date[]);

  select count(*) into v_weekly  from unnest(v_days) x where x >= v_monday and x <= v_today;
  select count(*) into v_monthly from unnest(v_days) x where to_char(x, 'YYYY-MM') = to_char(v_today, 'YYYY-MM');

  -- Streak mit 1 Tag Karenz (wie computeStreak): heute ODER gestern muss aktiv sein.
  v_cursor := v_today;
  if not (v_cursor = any(v_days)) then
    v_cursor := v_cursor - 1;
    if not (v_cursor = any(v_days)) then
      v_cursor := null; -- Streak = 0
    end if;
  end if;
  while v_cursor is not null and (v_cursor = any(v_days)) loop
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  NEW.weekly_days  := v_weekly;
  NEW.monthly_days := v_monthly;
  NEW.streak       := v_streak;
  NEW.week_key     := to_char(v_monday, 'YYYY-MM-DD');
  NEW.month_key    := to_char(v_today, 'YYYY-MM');
  NEW.updated_at   := now();
  return NEW;
end;
$$;

drop trigger if exists leaderboard_recompute on public.leaderboard_entries;
create trigger leaderboard_recompute
  before insert or update on public.leaderboard_entries
  for each row execute function public._leaderboard_recompute();

-- ---------------------------------------------------------------------------
-- B) Großzügige Mengen-Limits (Anti-Runaway) - legitime Nutzer treffen sie nie.
-- ---------------------------------------------------------------------------
create or replace function public._enforce_row_quota()
returns trigger
language plpgsql
as $$
begin
  if TG_TABLE_NAME = 'meal_favorites' then
    if (select count(*) from public.meal_favorites where user_id = NEW.user_id) >= 500 then
      raise exception 'Favoriten-Limit erreicht (max. 500).';
    end if;
  elsif TG_TABLE_NAME = 'foods' then
    if NEW.user_id is not null
       and (select count(*) from public.foods where user_id = NEW.user_id) >= 2000 then
      raise exception 'Limit fuer eigene Lebensmittel erreicht (max. 2000).';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists meal_favorites_quota on public.meal_favorites;
create trigger meal_favorites_quota
  before insert on public.meal_favorites
  for each row execute function public._enforce_row_quota();

drop trigger if exists foods_quota on public.foods;
create trigger foods_quota
  before insert on public.foods
  for each row execute function public._enforce_row_quota();
