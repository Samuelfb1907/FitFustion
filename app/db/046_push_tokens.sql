-- ============================================================================
--  Migration 046 - Push-Tokens (fuer Remote-Push, z. B. Anstupsen)
--  Im Supabase SQL Editor ausfuehren. Idempotent. Rein additiv.
--
--  Speichert je Nutzer EINEN Expo-Push-Token (zuletzt registriertes Geraet). Die Edge
--  Function "send-nudge" liest den Token des Empfaengers (Service-Role) und schickt den Push.
--  RLS: jeder verwaltet nur seinen eigenen Token.
-- ============================================================================
create table if not exists public.push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_rw_own" on public.push_tokens;
create policy "push_tokens_rw_own" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
