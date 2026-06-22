-- ============================================================================
--  Migration 045 - Anstupsen / Nudges (#48d)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Ein Nutzer stupst einen FREUND an (per friend_code). In-App-Loesung (kein Remote-Push):
--  der Empfaenger sieht den Stups beim naechsten App-Oeffnen (pending_nudges -> markiert
--  gesehen). RLS: nur eigene (empfangene) Nudges lesbar; Senden/Sehen nur ueber die RPCs.
-- ============================================================================
create table if not exists public.nudges (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  from_name  text not null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists nudges_to_unseen_idx on public.nudges(to_user) where seen_at is null;

alter table public.nudges enable row level security;
drop policy if exists "nudges_select_own" on public.nudges;
create policy "nudges_select_own" on public.nudges for select using (to_user = auth.uid());

-- Freund per Code anstupsen. Nur wenn befreundet; kein Doppel-Stups, solange ungesehen.
create or replace function public.send_nudge(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare target uuid; my_name text;
begin
  select id into target from public.profiles where friend_code = upper(trim(p_code));
  if target is null or target = auth.uid() then return false; end if;
  if not exists (select 1 from public.friendships where user_id = auth.uid() and friend_id = target) then
    return false; -- nur Freunde
  end if;
  if exists (select 1 from public.nudges where from_user = auth.uid() and to_user = target and seen_at is null) then
    return true;  -- schon angestupst (noch ungesehen) -> kein Spam
  end if;
  select coalesce(nullif(first_name, ''), 'Ein Freund') into my_name from public.profiles where id = auth.uid();
  insert into public.nudges(from_user, to_user, from_name) values (auth.uid(), target, my_name);
  return true;
end; $$;
revoke all on function public.send_nudge(text) from public, anon;
grant execute on function public.send_nudge(text) to authenticated;

-- Offene Nudges abrufen UND als gesehen markieren (gibt die Absender-Namen + Zeit zurueck).
create or replace function public.pending_nudges()
returns table (from_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select n.from_name, n.created_at from public.nudges n
    where n.to_user = auth.uid() and n.seen_at is null
    order by n.created_at desc;
  update public.nudges set seen_at = now() where to_user = auth.uid() and seen_at is null;
end; $$;
revoke all on function public.pending_nudges() from public, anon;
grant execute on function public.pending_nudges() to authenticated;
