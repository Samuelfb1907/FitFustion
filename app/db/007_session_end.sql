-- ============================================================================
--  FitFusion - Migration 007: Training manuell beenden
-- ----------------------------------------------------------------------------
--  Fuegt der Tabelle workout_sessions die Spalte "ended_at" hinzu.
--
--  Solange ended_at NULL ist, gilt ein Training als "laeuft noch" und neue
--  Saetze werden ihm zugeordnet. Mit dem Button "Training beenden" wird
--  ended_at gesetzt -> der naechste Satz startet ein NEUES Training
--  (auch am selben Tag, z. B. morgens und abends).
--
--  So ausfuehren: Supabase-Dashboard -> SQL Editor -> einfuegen -> Run.
--  Idempotent: mehrfaches Ausfuehren schadet nicht.
-- ============================================================================

alter table public.workout_sessions
  add column if not exists ended_at timestamptz;

-- Fertig. Pruefen mit:
--   select id, performed_at, ended_at from public.workout_sessions order by performed_at desc;
