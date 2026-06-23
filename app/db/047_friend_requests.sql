-- ============================================================================
--  Migration 047 - Freundschaftsanfragen (annehmen/ablehnen) (#48e)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Bisher (043) machte add_friend_by_code sofort eine beidseitige Freundschaft. JETZT:
--  add_friend_by_code legt eine ANFRAGE an; der Empfaenger nimmt sie an (-> beidseitige
--  Freundschaft) oder lehnt ab. Bestehende friendships bleiben unveraendert (= angenommen).
--  Spezialfall: hat der andere MICH schon angefragt, wird beim Hinzufuegen sofort bestaetigt.
-- ============================================================================
create table if not exists public.friend_requests (
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists friend_requests_to_idx on public.friend_requests(to_user);
alter table public.friend_requests enable row level security;
drop policy if exists "friend_requests_select_involved" on public.friend_requests;
create policy "friend_requests_select_involved" on public.friend_requests
  for select using (from_user = auth.uid() or to_user = auth.uid());
-- Schreiben nur ueber die SECURITY-DEFINER-RPCs.

-- add_friend_by_code NEU: erstellt eine Anfrage. Status: 'requested' | 'accepted'
-- (wenn der andere mich schon angefragt hatte) | 'already_friends' | 'error'.
create or replace function public.add_friend_by_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from public.profiles where friend_code = upper(trim(p_code));
  if target is null or target = auth.uid() then return 'error'; end if;
  if exists (select 1 from public.friendships where user_id = auth.uid() and friend_id = target) then
    return 'already_friends';
  end if;
  -- Gegenanfrage vorhanden? -> sofort bestaetigen.
  if exists (select 1 from public.friend_requests where from_user = target and to_user = auth.uid()) then
    insert into public.friendships(user_id, friend_id) values (auth.uid(), target) on conflict do nothing;
    insert into public.friendships(user_id, friend_id) values (target, auth.uid()) on conflict do nothing;
    delete from public.friend_requests
      where (from_user = target and to_user = auth.uid()) or (from_user = auth.uid() and to_user = target);
    return 'accepted';
  end if;
  insert into public.friend_requests(from_user, to_user) values (auth.uid(), target) on conflict do nothing;
  return 'requested';
end; $$;
revoke all on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;

-- Eingehende Anfragen (an mich): Name + Code des Absenders (zum Annehmen/Ablehnen).
create or replace function public.incoming_requests()
returns table (friend_code text, display_name text)
language sql security definer set search_path = public as $$
  select p.friend_code, coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as display_name
  from public.friend_requests r
  join public.profiles p on p.id = r.from_user
  where r.to_user = auth.uid()
  order by r.created_at desc;
$$;
revoke all on function public.incoming_requests() from public, anon;
grant execute on function public.incoming_requests() to authenticated;

-- Anfrage annehmen (per Absender-Code): beidseitige Freundschaft + Anfrage(n) loeschen.
create or replace function public.accept_request(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare requester uuid;
begin
  select id into requester from public.profiles where friend_code = upper(trim(p_code));
  if requester is null then return false; end if;
  if not exists (select 1 from public.friend_requests where from_user = requester and to_user = auth.uid()) then
    return false;
  end if;
  insert into public.friendships(user_id, friend_id) values (auth.uid(), requester) on conflict do nothing;
  insert into public.friendships(user_id, friend_id) values (requester, auth.uid()) on conflict do nothing;
  delete from public.friend_requests
    where (from_user = requester and to_user = auth.uid()) or (from_user = auth.uid() and to_user = requester);
  return true;
end; $$;
revoke all on function public.accept_request(text) from public, anon;
grant execute on function public.accept_request(text) to authenticated;

-- Anfrage ablehnen (per Absender-Code).
create or replace function public.decline_request(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare requester uuid;
begin
  select id into requester from public.profiles where friend_code = upper(trim(p_code));
  if requester is null then return; end if;
  delete from public.friend_requests where from_user = requester and to_user = auth.uid();
end; $$;
revoke all on function public.decline_request(text) from public, anon;
grant execute on function public.decline_request(text) to authenticated;
