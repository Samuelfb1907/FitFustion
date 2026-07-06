-- ============================================================================
--  Migration 062 - Kudos auf Freunde-Aktivitaeten (Phase 1a "FitAvo goes Strava")
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  activity_kudos: wer hat welches Feed-Ereignis "gefeuert". toggle_kudos schaltet um
--  (nur fuer Ereignisse von FREUNDEN, serverseitig geprueft). friends_feed liefert jetzt
--  zusaetzlich id + kudos_count + i_kudosed. Siehe auch Migration 048 (Feed-Basis).
-- ============================================================================
create table if not exists public.activity_kudos (
  event_id   uuid not null references public.activity_events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists activity_kudos_event_idx on public.activity_kudos(event_id);
alter table public.activity_kudos enable row level security;
-- Kein direkter Client-Zugriff: alles laeuft ueber die SECURITY-DEFINER-RPCs.

create or replace function public.toggle_kudos(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.activity_events where id = p_event_id;
  if owner is null or owner = auth.uid() then return false; end if;
  if not exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = owner) then
    return false;
  end if;
  if exists (select 1 from public.activity_kudos where event_id = p_event_id and user_id = auth.uid()) then
    delete from public.activity_kudos where event_id = p_event_id and user_id = auth.uid();
    return false;
  else
    insert into public.activity_kudos(event_id, user_id) values (p_event_id, auth.uid());
    return true;
  end if;
end; $$;
revoke all on function public.toggle_kudos(uuid) from public, anon;
grant execute on function public.toggle_kudos(uuid) to authenticated;

drop function if exists public.friends_feed();
create function public.friends_feed()
returns table (id uuid, display_name text, type text, detail text, created_at timestamptz, kudos_count int, i_kudosed boolean)
language sql security definer set search_path = public as $$
  select e.id,
         coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as display_name,
         e.type, e.detail, e.created_at,
         (select count(*)::int from public.activity_kudos k where k.event_id = e.id) as kudos_count,
         exists (select 1 from public.activity_kudos k where k.event_id = e.id and k.user_id = auth.uid()) as i_kudosed
  from public.activity_events e
  join public.friendships f on f.friend_id = e.user_id and f.user_id = auth.uid()
  join public.profiles p on p.id = e.user_id
  where e.created_at >= now() - interval '14 days'
  order by e.created_at desc
  limit 50;
$$;
revoke all on function public.friends_feed() from public, anon;
grant execute on function public.friends_feed() to authenticated;
