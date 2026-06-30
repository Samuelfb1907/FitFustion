-- ============================================================================
--  Migration 053 - Auto-Progression: Zielgewicht im Trainingsplan
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  target_weight_kg: Soll-Gewicht pro Plan-Uebung (NULL = noch nicht gesetzt,
--  wird beim ersten Training automatisch geseedet).
-- ============================================================================
alter table public.workout_plan_exercises
  add column if not exists target_weight_kg numeric(6,2);
