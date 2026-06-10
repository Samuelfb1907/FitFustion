-- ============================================================================
--  Migration 028 - Mehr Brust-Uebungen mit Koerpergewicht (echte ExerciseDB-GIFs)
--  Die animierten GIFs werden client-seitig ueber app/lib/exerciseMedia.ts anhand
--  des Uebungs-NAMENS aufgeloest (ExerciseDB-IDs siehe dort). Hier nur Datensaetze.
--  Im Supabase SQL Editor ausfuehren. Idempotent (fuegt nur fehlende ein). Optional (nur Seeds).
-- ============================================================================
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  ('Breite Liegestütze','beginner','bodyweight','chest','Liegestütze mit weiter Handstellung, betont die äußere Brust.','1. Hände deutlich weiter als schulterbreit aufsetzen. 2. Brust kontrolliert zum Boden senken. 3. Kräftig hochdrücken.'),
  ('Push-up Plus','beginner','bodyweight','chest','Liegestütz mit zusätzlichem Vorschieben der Schulterblätter (Serratus).','1. Liegestütz-Position halten. 2. Oben zusätzlich den oberen Rücken nach oben schieben (Schulterblätter auseinander). 3. Kontrolliert zurück.'),
  ('Liegestütze mit Schulter-Tap','intermediate','bodyweight','chest','Liegestütze mit Antippen der Schulter – fordert zusätzlich den Rumpf.','1. Liegestütz-Position, Füße etwas breiter. 2. Nach jedem Hochdrücken die gegenüberliegende Schulter antippen. 3. Hüfte ruhig halten.'),
  ('Uhr-Liegestütze','intermediate','bodyweight','chest','Liegestütze, bei denen die Hände im Kreis wandern – fordernde Variante.','1. Liegestütz-Position einnehmen. 2. Hände nach jeder Wiederholung ein Stück im Kreis versetzen. 3. Eine volle Runde absolvieren.'),
  ('Archer-Liegestütze','advanced','bodyweight','chest','Einseitig betonte Liegestütze – Vorstufe zur einarmigen Liegestütze.','1. Sehr breite Handstellung. 2. Zu einer Seite absenken, der andere Arm bleibt fast gestreckt. 3. Hochdrücken und die Seite wechseln.'),
  ('Klatsch-Liegestütze','advanced','bodyweight','chest','Explosive Liegestütze mit Klatschen – trainiert die Schnellkraft.','1. Explosiv vom Boden abdrücken. 2. In der Luft kurz in die Hände klatschen. 3. Weich abfangen und sofort wiederholen.'),
  ('Einarmige Liegestütze','advanced','bodyweight','chest','Liegestütze auf einem Arm – maximale Brust- und Rumpfkraft.','1. Füße breit, eine Hand mittig am Boden. 2. Körper langsam absenken. 3. Hochdrücken, Rumpf fest, ohne zu verdrehen.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);
