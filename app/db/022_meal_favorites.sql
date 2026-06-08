-- ============================================================================
--  Migration 022 - Favoriten (gespeicherte Mahlzeiten) fuer den Essens-Tracker
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  Eine Zeile = ein Favorit (z. B. "Mein Fruehstueck") mit mehreren Zutaten,
--  die als JSON (items) gespeichert werden:
--    [{ "food_id": "...", "name": "...", "amount_g": 60,
--       "kcal": 370, "protein": 13, "carbs": 60, "fat": 7 }, ...]
-- ============================================================================
create table if not exists public.meal_favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meal_favorites_user_idx on public.meal_favorites(user_id, created_at desc);

alter table public.meal_favorites enable row level security;
drop policy if exists "meal_favorites_all_own" on public.meal_favorites;
create policy "meal_favorites_all_own" on public.meal_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
