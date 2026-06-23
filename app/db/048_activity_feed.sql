-- ============================================================================
--  Migration 048 - Freunde-Aktivitaets-Feed (#48f)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  activity_events haelt kleine Ereignisse ('trained' / 'record'). log_activity schreibt sie
--  (mit Anti-Spam: gleiches Ereignis je 6h nur 1x). friends_feed gibt die Ereignisse MEINER
--  Freunde zurueck (mit Anzeigename), neueste zuerst. Nur Freunde sehen die Ereignisse.
-- ============================================================================
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('trained', 'record')),
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists activity_events_user_idx on public.activity_events(user_id, created_at desc);
alter table public.activity_events enable row level security;
drop policy if exists "activity_events_select_own" on public.activity_events;
create policy "activity_events_select_own" on public.activity_events for select using (user_id = auth.uid());
-- Schreiben + Freunde-Feed laufen ueber die SECURITY-DEFINER-RPCs.

-- Ereignis protokollieren. Gleiches (type, detail) je Nutzer max. 1x in 6 Stunden (Anti-Spam).
create or replace function public.log_activity(p_type text, p_detail text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d text := left(coalesce(p_detail, ''), 60);
begin
  if p_type not in ('trained', 'record') then return; end if;
  if exists (
    select 1 from public.activity_events
    where user_id = auth.uid() and type = p_type and coalesce(detail, '') = d
      and created_at > now() - interval '6 hours'
  ) then
    return;
  end if;
  insert into public.activity_events(user_id, type, detail) values (auth.uid(), p_type, nullif(d, ''));
end; $$;
revoke all on function public.log_activity(text, text) from public, anon;
grant execute on function public.log_activity(text, text) to authenticated;

-- Feed: Ereignisse meiner Freunde (mit Anzeigename), letzte 14 Tage, neueste zuerst.
create or replace function public.friends_feed()
returns table (display_name text, type text, detail text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as display_name, e.type, e.detail, e.created_at
  from public.activity_events e
  join public.friendships f on f.friend_id = e.user_id and f.user_id = auth.uid()
  join public.profiles p on p.id = e.user_id
  where e.created_at >= now() - interval '14 days'
  order by e.created_at desc
  limit 50;
$$;
revoke all on function public.friends_feed() from public, anon;
grant execute on function public.friends_feed() to authenticated;
