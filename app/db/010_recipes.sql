-- ============================================================================
--  Migration 010 - Eigene Rezepte / Mahlzeiten
--  Im Supabase SQL Editor ausfuehren. Idempotent.
-- ============================================================================
create table if not exists public.recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists recipes_user_idx on public.recipes(user_id);

create table if not exists public.recipe_items (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id   uuid not null references public.foods(id),
  amount_g  numeric(7,1) not null
);
create index if not exists recipe_items_recipe_idx on public.recipe_items(recipe_id);

alter table public.recipes enable row level security;
drop policy if exists "recipes_all_own" on public.recipes;
create policy "recipes_all_own" on public.recipes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.recipe_items enable row level security;
drop policy if exists "recipe_items_all_own" on public.recipe_items;
create policy "recipe_items_all_own" on public.recipe_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
