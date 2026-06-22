-- ============================================================================
--  Migration 043 - Freund-Codes (#48c): kurzer, teilbarer Code je Nutzer + Beitritt per Code
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Jeder Nutzer bekommt einen kurzen profiles.friend_code (z. B. A3F9C1). Damit kann man sich
--  gegenseitig per Code als Freund hinzufuegen (beidseitig). Baut auf friendships (Migration 041).
-- ============================================================================
alter table public.profiles add column if not exists friend_code text;

-- Bestehende Nutzer ohne Code: eindeutigen 6-stelligen Code (Hex, Grossbuchstaben) vergeben.
update public.profiles set friend_code = upper(substr(md5(gen_random_uuid()::text), 1, 6)) where friend_code is null;

-- Neue Nutzer bekommen automatisch einen Code; danach Pflicht + eindeutig.
alter table public.profiles alter column friend_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));
alter table public.profiles alter column friend_code set not null;
create unique index if not exists profiles_friend_code_idx on public.profiles(friend_code);

-- Freund per Code hinzufuegen (beidseitig). Gibt den Vornamen zurueck, oder null (Code unbekannt/eigener).
create or replace function public.add_friend_by_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare target uuid; target_name text;
begin
  select id, coalesce(nullif(first_name, ''), 'FitAvo-Freund') into target, target_name
    from public.profiles where friend_code = upper(trim(p_code));
  if target is null or target = auth.uid() then return null; end if;
  insert into public.friendships(user_id, friend_id) values (auth.uid(), target) on conflict do nothing;
  insert into public.friendships(user_id, friend_id) values (target, auth.uid()) on conflict do nothing;
  return target_name;
end; $$;
revoke all on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;

-- Meine Freunde: Anzeigename + deren Code (zum Entfernen). KEINE UUID -> kein Leak.
create or replace function public.friends_list()
returns table (friend_code text, display_name text)
language sql security definer set search_path = public as $$
  select p.friend_code, coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as display_name
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by display_name asc;
$$;
revoke all on function public.friends_list() from public, anon;
grant execute on function public.friends_list() to authenticated;

-- Freund per Code entfernen (beidseitig).
create or replace function public.remove_friend_by_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select id into target from public.profiles where friend_code = upper(trim(p_code));
  if target is null then return; end if;
  delete from public.friendships
   where (user_id = auth.uid() and friend_id = target)
      or (user_id = target and friend_id = auth.uid());
end; $$;
revoke all on function public.remove_friend_by_code(text) from public, anon;
grant execute on function public.remove_friend_by_code(text) to authenticated;
