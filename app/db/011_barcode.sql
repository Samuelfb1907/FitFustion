-- ============================================================================
--  Migration 011 - Barcode-Scanner: foods um barcode + user_id erweitern
--  und Schreibrechte fuer eigene (gescannte) Lebensmittel geben.
--  Im Supabase SQL Editor ausfuehren. Idempotent.
-- ============================================================================

-- Neue Spalten: barcode (zum Wiederfinden) + user_id (Besitzer der Eigen-Eintraege).
-- Die vorhandenen (eingespielten) Lebensmittel behalten user_id = NULL und bleiben global.
alter table public.foods add column if not exists barcode text;
alter table public.foods add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Ein Barcode soll nur einmal vorkommen (NULL-Werte ausgenommen).
create unique index if not exists foods_barcode_idx on public.foods(barcode) where barcode is not null;

-- Eingeloggte Nutzer duerfen eigene Lebensmittel anlegen ...
drop policy if exists "foods_insert_own" on public.foods;
create policy "foods_insert_own" on public.foods for insert to authenticated with check (auth.uid() = user_id);

-- ... und ihre eigenen wieder loeschen (die globalen mit user_id = NULL nicht).
drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own" on public.foods for delete to authenticated using (auth.uid() = user_id);
