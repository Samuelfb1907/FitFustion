-- ============================================================================
--  Migration 063 - Kommentare auf Freunde-Aktivitaeten (Phase 1b)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  activity_comments + RPCs (add_comment / event_comments / delete_comment). Sichtbarkeit
--  ueber can_see_event (eigenes Ereignis ODER von einem Freund). friends_feed liefert
--  zusaetzlich comment_count. Baut auf Migration 048 (Feed) und 062 (Kudos) auf.
-- ============================================================================
create table if not exists public.activity_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.activity_events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists activity_comments_event_idx on public.activity_comments(event_id, created_at);
alter table public.activity_comments enable row level security;

create or replace function public.can_see_event(p_event_id uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.activity_events e
    where e.id = p_event_id
      and (e.user_id = auth.uid()
           or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = e.user_id))
  );
$$;

create or replace function public.add_comment(p_event_id uuid, p_body text)
returns table (id uuid, user_id uuid, display_name text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(p_body,'')); nid uuid;
begin
  if t = '' or char_length(t) > 300 then return; end if;
  if not public.can_see_event(p_event_id) then return; end if;
  insert into public.activity_comments(event_id, user_id, body) values (p_event_id, auth.uid(), t)
    returning activity_comments.id into nid;
  return query
    select c.id, c.user_id, coalesce(nullif(p.first_name,''),'FitAvo-Freund'), c.body, c.created_at
    from public.activity_comments c join public.profiles p on p.id = c.user_id
    where c.id = nid;
end; $$;
revoke all on function public.add_comment(uuid, text) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;

create or replace function public.event_comments(p_event_id uuid)
returns table (id uuid, user_id uuid, display_name text, body text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.user_id, coalesce(nullif(p.first_name,''),'FitAvo-Freund'), c.body, c.created_at
  from public.activity_comments c join public.profiles p on p.id = c.user_id
  where c.event_id = p_event_id and public.can_see_event(p_event_id)
  order by c.created_at asc limit 100;
$$;
revoke all on function public.event_comments(uuid) from public, anon;
grant execute on function public.event_comments(uuid) to authenticated;

create or replace function public.delete_comment(p_comment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity_comments where id = p_comment_id and user_id = auth.uid();
end; $$;
revoke all on function public.delete_comment(uuid) from public, anon;
grant execute on function public.delete_comment(uuid) to authenticated;

drop function if exists public.friends_feed();
create function public.friends_feed()
returns table (id uuid, display_name text, type text, detail text, created_at timestamptz,
               kudos_count int, i_kudosed boolean, comment_count int)
language sql security definer set search_path = public as $$
  select e.id,
         coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as display_name,
         e.type, e.detail, e.created_at,
         (select count(*)::int from public.activity_kudos k where k.event_id = e.id) as kudos_count,
         exists (select 1 from public.activity_kudos k where k.event_id = e.id and k.user_id = auth.uid()) as i_kudosed,
         (select count(*)::int from public.activity_comments cc where cc.event_id = e.id) as comment_count
  from public.activity_events e
  join public.friendships f on f.friend_id = e.user_id and f.user_id = auth.uid()
  join public.profiles p on p.id = e.user_id
  where e.created_at >= now() - interval '14 days'
  order by e.created_at desc
  limit 50;
$$;
revoke all on function public.friends_feed() from public, anon;
grant execute on function public.friends_feed() to authenticated;
