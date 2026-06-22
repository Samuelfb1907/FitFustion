-- ============================================================================
--  Migration 042 - Schritte-Lobbys (#48b): Gruppen mit taeglicher Schritte-Rangliste
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Lobby = benannte Gruppe mit kurzem Einladungs-Code. Mitglieder sehen die heutigen
--  Schritte aller Lobby-Kollegen, sortiert (meiste oben). daily_steps haelt eine Zeile
--  pro Nutzer/Tag. Beitritt/Erstellen laeuft ueber SECURITY-DEFINER-RPCs; direktes Lesen
--  ist per RLS auf die eigene Lobby beschraenkt (kein UUID-/Fremddaten-Leak).
-- ============================================================================

create table if not exists public.lobbies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.lobby_members (
  lobby_id     uuid not null references public.lobbies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Ich' check (char_length(display_name) between 1 and 24),
  joined_at    timestamptz not null default now(),
  primary key (lobby_id, user_id)
);
create index if not exists lobby_members_user_idx on public.lobby_members(user_id);

create table if not exists public.daily_steps (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  steps      int  not null default 0 check (steps >= 0 and steps <= 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.lobbies       enable row level security;
alter table public.lobby_members enable row level security;
alter table public.daily_steps   enable row level security;

-- SECURITY-DEFINER-Helfer (umgehen RLS -> keine Policy-Rekursion).
create or replace function public.is_lobby_member(p_lobby uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.lobby_members where lobby_id = p_lobby and user_id = auth.uid());
$$;
revoke all on function public.is_lobby_member(uuid) from public, anon;
grant execute on function public.is_lobby_member(uuid) to authenticated;

create or replace function public.shares_lobby_with(p_other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.lobby_members m1
    join public.lobby_members m2 on m1.lobby_id = m2.lobby_id
    where m1.user_id = auth.uid() and m2.user_id = p_other
  );
$$;
revoke all on function public.shares_lobby_with(uuid) from public, anon;
grant execute on function public.shares_lobby_with(uuid) to authenticated;

-- lobbies: Mitglieder sehen ihre Lobby.
drop policy if exists "lobbies_select_member" on public.lobbies;
create policy "lobbies_select_member" on public.lobbies for select using (public.is_lobby_member(id));

-- lobby_members: Mitglieder sehen die Mitglieder ihrer Lobbys; eigene Zeile aendern/loeschen.
drop policy if exists "lobby_members_select" on public.lobby_members;
create policy "lobby_members_select" on public.lobby_members for select using (public.is_lobby_member(lobby_id));
drop policy if exists "lobby_members_update_own" on public.lobby_members;
create policy "lobby_members_update_own" on public.lobby_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "lobby_members_delete_own" on public.lobby_members;
create policy "lobby_members_delete_own" on public.lobby_members for delete using (user_id = auth.uid());

-- daily_steps: eigene Zeilen schreiben/lesen; Lobby-Kollegen duerfen lesen.
drop policy if exists "daily_steps_rw_own" on public.daily_steps;
create policy "daily_steps_rw_own" on public.daily_steps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "daily_steps_select_comember" on public.daily_steps;
create policy "daily_steps_select_comember" on public.daily_steps for select using (public.shares_lobby_with(user_id));

-- Lobby erstellen; Ersteller wird Mitglied. Gibt die neue Lobby zurueck.
create or replace function public.create_lobby(p_name text, p_display_name text)
returns public.lobbies language plpgsql security definer set search_path = public as $$
declare l public.lobbies;
begin
  insert into public.lobbies(name, created_by)
    values (left(trim(p_name), 40), auth.uid())
    returning * into l;
  insert into public.lobby_members(lobby_id, user_id, display_name)
    values (l.id, auth.uid(), coalesce(nullif(left(trim(p_display_name), 24), ''), 'Ich'));
  return l;
end; $$;
revoke all on function public.create_lobby(text, text) from public, anon;
grant execute on function public.create_lobby(text, text) to authenticated;

-- Lobby per Code beitreten. Gibt die lobby_id zurueck (oder null bei unbekanntem Code).
create or replace function public.join_lobby(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare l_id uuid;
begin
  select id into l_id from public.lobbies where invite_code = upper(trim(p_code));
  if l_id is null then return null; end if;
  insert into public.lobby_members(lobby_id, user_id, display_name)
    values (l_id, auth.uid(), coalesce(nullif(left(trim(p_display_name), 24), ''), 'Ich'))
    on conflict (lobby_id, user_id) do update set display_name = excluded.display_name;
  return l_id;
end; $$;
revoke all on function public.join_lobby(text, text) from public, anon;
grant execute on function public.join_lobby(text, text) to authenticated;

-- Heutige Schritte hochladen (upsert; nur hochzaehlen, nie verringern -> robust gegen Re-Syncs).
create or replace function public.upsert_today_steps(p_steps int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.daily_steps(user_id, day, steps, updated_at)
    values (auth.uid(), (now() at time zone 'Europe/Berlin')::date, greatest(0, coalesce(p_steps, 0)), now())
  on conflict (user_id, day)
    do update set steps = greatest(public.daily_steps.steps, excluded.steps), updated_at = now();
end; $$;
revoke all on function public.upsert_today_steps(int) from public, anon;
grant execute on function public.upsert_today_steps(int) to authenticated;

-- Tagesrangliste einer Lobby: Mitglieder + heutige Schritte, meiste oben. Nur fuer Mitglieder.
-- Gibt KEINE user_id zurueck (nur Anzeigename + is_me) -> kein UUID-Leak.
create or replace function public.lobby_board(p_lobby uuid)
returns table (display_name text, steps_today int, is_me boolean)
language sql security definer set search_path = public as $$
  select m.display_name,
         coalesce(ds.steps, 0)::int as steps_today,
         (m.user_id = auth.uid()) as is_me
  from public.lobby_members m
  left join public.daily_steps ds
    on ds.user_id = m.user_id and ds.day = (now() at time zone 'Europe/Berlin')::date
  where m.lobby_id = p_lobby and public.is_lobby_member(p_lobby)
  order by steps_today desc, m.display_name asc;
$$;
revoke all on function public.lobby_board(uuid) from public, anon;
grant execute on function public.lobby_board(uuid) to authenticated;
