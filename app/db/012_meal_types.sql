-- ============================================================================
--  Migration 012 - Mahlzeiten-Zeiten: food_logs um meal_type erweitern
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  Werte: breakfast | lunch | dinner | snack  (NULL = noch nicht zugeordnet)
-- ============================================================================
alter table public.food_logs add column if not exists meal_type text;

alter table public.food_logs drop constraint if exists food_logs_meal_type_check;
alter table public.food_logs add constraint food_logs_meal_type_check
  check (meal_type is null or meal_type in ('breakfast','lunch','dinner','snack'));
