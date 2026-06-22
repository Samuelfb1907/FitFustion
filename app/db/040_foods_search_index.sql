-- ============================================================================
--  Migration 040 - Trigram-Index fuer die Lebensmittel-Suche (Performance)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  Beschleunigt die ilike-Suche auf foods.name (FoodTracker) deutlich, je groesser
--  die foods-Tabelle wird. pg_trgm liefert Trigram-Matching fuer einen GIN-Index.
--  (Teil 1 von #58; die clientseitige ProgressScreen-Aggregation bleibt separat.)
-- ============================================================================
create extension if not exists pg_trgm;
create index if not exists foods_name_trgm_idx on public.foods using gin (name gin_trgm_ops);
