-- ============================================================================
--  Migration 068 - GPS-Route fuer Cardio (Phase 3, Laufen/Rad mit Karte)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  GPS-Laeufe werden als cardio_sessions gespeichert (activity_key running/cycling/walking),
--  damit sie automatisch aufs Kalorien-Tagesziel zaehlen und in der Cardio-Liste erscheinen.
--  Zusaetzlich: route (Punktliste [{lat,lng,t}]) fuer die Karte + distance_m fuer Distanz/Tempo.
--  Baut auf Migration 059 (cardio_sessions) auf.
-- ============================================================================
alter table public.cardio_sessions add column if not exists route      jsonb;
alter table public.cardio_sessions add column if not exists distance_m  integer;
