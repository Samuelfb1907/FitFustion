-- ============================================================================
--  Migration 015 - Datenschutz (foods-Leseregel) + Performance-Indizes
--  Im Supabase SQL Editor ausfuehren. Idempotent.
-- ============================================================================

-- foods: eigene/gescannte Lebensmittel nur fuer den Besitzer sichtbar;
-- globale Stammdaten (user_id IS NULL) fuer alle eingeloggten Nutzer lesbar.
drop policy if exists "foods_read_all" on public.foods;
drop policy if exists "foods_read_global_or_own" on public.foods;
create policy "foods_read_global_or_own" on public.foods
  for select to authenticated
  using (user_id is null or auth.uid() = user_id);

-- Indizes auf haeufig gefilterten/gejointen Spalten
create index if not exists food_logs_food_idx on public.food_logs(food_id);
create index if not exists progress_user_date_idx on public.progress_entries(user_id, entry_date);
create index if not exists foods_category_idx on public.foods(category);
