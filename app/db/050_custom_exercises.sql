-- ============================================================================
--  Migration 050 - Eigene Uebungen (#7)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Eigene Uebungen sind ECHTE exercises-Zeilen (mit created_by = Nutzer), damit set_logs
--  per FK darauf zeigen kann (Saetze loggen). Globale Uebungen haben created_by = null.
--  Lese-Policy: globale fuer alle + eigene; KEINE fremden eigenen. Schreiben nur eigene.
-- ============================================================================
alter table public.exercises add column if not exists created_by uuid references auth.users(id) on delete cascade;
create index if not exists exercises_created_by_idx on public.exercises(created_by);

-- Bisherige "alle lesen alles"-Policy (using true) ersetzen: globale + eigene custom.
drop policy if exists "exercises_read_all" on public.exercises;
drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises
  for select using (created_by is null or created_by = auth.uid());

drop policy if exists "exercises_insert_own" on public.exercises;
create policy "exercises_insert_own" on public.exercises
  for insert with check (created_by = auth.uid());
drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own" on public.exercises
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises
  for delete using (created_by = auth.uid());
