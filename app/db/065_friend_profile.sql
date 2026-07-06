-- ============================================================================
--  Migration 065 - Freund-Profil (Phase 1c-lite)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  friend_profile(p_code) liefert die OEFFENTLICH-fuer-Freunde geeigneten Kennzahlen eines
--  Nutzers (per kurzem Freund-Code): Streak, Trainings, Saetze, Tonnage, Cardio, aktive Tage
--  und die letzten Rekorde. SECURITY DEFINER + Freundschafts-Check (oder man selbst).
--  BEWUSST NICHT enthalten: Gewicht, Kalorien, Essen, Koerpermasse (privat).
--  Baut auf friendships (041/047) und activity_events (048) auf.
-- ============================================================================
create or replace function public.friend_profile(p_code text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  me     uuid := auth.uid();
  target uuid;
  result jsonb;
begin
  if me is null then return null; end if;
  select id into target from public.profiles where friend_code = upper(btrim(coalesce(p_code, '')));
  if target is null then return null; end if;
  -- Nur eigenes Profil oder das eines bestaetigten Freundes.
  if target <> me and not exists (
    select 1 from public.friendships f where f.user_id = me and f.friend_id = target
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'display_name', coalesce(nullif(p.first_name, ''), 'FitAvo-Freund'),
    'is_me',        (p.id = me),
    'member_since', p.created_at,
    'streak',       case when p.streak_last_day is not null and (current_date - p.streak_last_day) <= 1
                         then coalesce(p.streak_current, 0) else 0 end,
    'best_streak',  coalesce(p.streak_best, 0),
    'workouts',     (select count(*) from public.workout_sessions w where w.user_id = target),
    'sets',         (select count(*) from public.set_logs s where s.user_id = target),
    'tonnage_kg',   (select coalesce(round(sum(coalesce(s.weight_kg, 0) * coalesce(s.reps, 0))), 0)::bigint
                       from public.set_logs s where s.user_id = target),
    'cardio_count', (select count(*) from public.cardio_sessions cs where cs.user_id = target),
    'cardio_kcal',  (select coalesce(sum(cs.kcal), 0) from public.cardio_sessions cs where cs.user_id = target),
    'active_days',  (select count(distinct d) from (
                        select date(w.performed_at) d from public.workout_sessions w where w.user_id = target
                        union
                        select date(cs.performed_at) d from public.cardio_sessions cs where cs.user_id = target
                     ) x),
    'records',      coalesce((
                        select jsonb_agg(jsonb_build_object('ex', r.detail, 'created_at', r.created_at)
                                         order by r.created_at desc)
                        from (
                          select e.detail, e.created_at from public.activity_events e
                          where e.user_id = target and e.type = 'record'
                          order by e.created_at desc limit 5
                        ) r
                     ), '[]'::jsonb)
  ) into result
  from public.profiles p where p.id = target;

  return result;
end; $$;
revoke all on function public.friend_profile(text) from public, anon;
grant execute on function public.friend_profile(text) to authenticated;
