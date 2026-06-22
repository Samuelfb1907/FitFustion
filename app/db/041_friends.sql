-- ============================================================================
--  Migration 041 - Freunde (Einladungslink) + private Freundes-Bestenliste (#48)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Modell: Eine Freundschaft = ZWEI Zeilen (a->b und b->a) fuer einfache symmetrische
--  Queries. Hinzufuegen NUR ueber die SECURITY-DEFINER-RPC add_friend (Einladungs-Code =
--  User-ID des Einladenden, geteilt per Link). Direktes INSERT durch Clients ist NICHT
--  erlaubt; Clients duerfen nur ihre EIGENEN Freundschaften lesen/loeschen.
-- ============================================================================
create table if not exists public.friendships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_user_idx on public.friendships(user_id);

alter table public.friendships enable row level security;
drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships for select using (auth.uid() = user_id);
drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own" on public.friendships for delete using (auth.uid() = user_id);

-- Freund per Code (= User-ID des Einladenden) hinzufuegen; legt beide Richtungen an.
create or replace function public.add_friend(p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_friend is null or p_friend = auth.uid() then return; end if;
  if not exists (select 1 from public.profiles where id = p_friend) then return; end if; -- nur echte Konten
  insert into public.friendships(user_id, friend_id) values (auth.uid(), p_friend) on conflict do nothing;
  insert into public.friendships(user_id, friend_id) values (p_friend, auth.uid()) on conflict do nothing;
end; $$;
revoke all on function public.add_friend(uuid) from public, anon;
grant execute on function public.add_friend(uuid) to authenticated;

-- Freundschaft beenden (beide Richtungen).
create or replace function public.remove_friend(p_friend uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (user_id = auth.uid() and friend_id = p_friend)
      or (user_id = p_friend and friend_id = auth.uid());
end; $$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Freundes-Bestenliste: meine + meiner Freunde Eintraege (nur wer in der Bestenliste ist).
-- Anzeigename/Punkte kommen aus leaderboard_entries (opt-in), kein UUID-Leak.
create or replace function public.friends_leaderboard()
returns table (display_name text, weekly_days int, monthly_days int, streak int, week_key text, month_key text, is_me boolean)
language sql security definer set search_path = public as $$
  select le.display_name, le.weekly_days, le.monthly_days, le.streak, le.week_key, le.month_key,
         (le.user_id = auth.uid()) as is_me
  from public.leaderboard_entries le
  where le.user_id = auth.uid()
     or le.user_id in (select friend_id from public.friendships where user_id = auth.uid());
$$;
revoke all on function public.friends_leaderboard() from public, anon;
grant execute on function public.friends_leaderboard() to authenticated;
