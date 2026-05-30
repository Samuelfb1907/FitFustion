-- ============================================================================
--  Migration 003 – Mehr Beispiel-Übungen (verteilt auf alle Muskelgruppen)
--  Im Supabase SQL Editor ausführen. Idempotent: fügt nur fehlende Übungen ein.
-- ============================================================================
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  -- Brust
  ('Kurzhantel-Bankdrücken','intermediate','dumbbell','chest','Brustübung mit Kurzhanteln, großer Bewegungsradius.','1. Rücklings auf die Bank. 2. Kurzhanteln über der Brust. 3. Kontrolliert senken und drücken.'),
  ('Schrägbankdrücken','advanced','barbell','chest','Betont die obere Brustmuskulatur.','1. Bank auf ca. 30 Grad. 2. Stange zur oberen Brust senken. 3. Nach oben drücken.'),
  ('Brustpresse (Maschine)','beginner','machine','chest','Geführte Brustübung, ideal für Einsteiger.','1. Griffe auf Brusthöhe. 2. Nach vorn drücken. 3. Langsam zurückführen.'),
  -- Rücken
  ('Kurzhantel-Rudern','intermediate','dumbbell','back','Einarmiges Rudern für den Rücken.','1. Knie/Hand auf der Bank. 2. Kurzhantel zur Hüfte ziehen. 3. Kontrolliert senken.'),
  ('Latzug (Maschine)','beginner','machine','back','Geführte Zugübung für den breiten Rücken.','1. Stange greifen. 2. Zur oberen Brust ziehen. 3. Langsam zurückführen.'),
  ('Superman','beginner','bodyweight','back','Rückenstrecker-Übung am Boden.','1. Auf den Bauch legen. 2. Arme und Beine anheben. 3. Kurz halten, dann senken.'),
  -- Schultern
  ('Schulterdrücken (Kurzhantel)','intermediate','dumbbell','shoulders','Drückübung für die Schultern.','1. Kurzhanteln auf Schulterhöhe. 2. Nach oben drücken. 3. Kontrolliert senken.'),
  ('Seitheben','beginner','dumbbell','shoulders','Formt die seitliche Schulter.','1. Kurzhanteln seitlich halten. 2. Bis Schulterhöhe heben. 3. Langsam senken.'),
  ('Pike Push-ups','advanced','bodyweight','shoulders','Schulter-Liegestütze in der V-Position.','1. Hüfte hoch (umgekehrtes V). 2. Kopf Richtung Boden senken. 3. Hochdrücken.'),
  -- Bizeps
  ('Bizeps-Curls (Kurzhantel)','beginner','dumbbell','biceps','Klassische Bizepsübung.','1. Kurzhanteln hängen lassen. 2. Zur Schulter curlen. 3. Kontrolliert senken.'),
  ('Langhantel-Curls','intermediate','barbell','biceps','Bizeps mit der Langhantel.','1. Stange schulterbreit greifen. 2. Hochcurlen. 3. Langsam senken.'),
  ('Hammer-Curls','beginner','dumbbell','biceps','Trainiert Bizeps und Unterarm.','1. Neutraler Griff. 2. Hochcurlen. 3. Senken.'),
  -- Trizeps
  ('Trizeps-Dips (Bank)','intermediate','bodyweight','triceps','Dips an einer Bank oder einem Stuhl.','1. Hände auf der Bank, Beine vorn. 2. Körper absenken. 3. Hochdrücken.'),
  ('Trizeps-Drücken (Kurzhantel)','beginner','dumbbell','triceps','Überkopf-Trizepsübung.','1. Kurzhantel über dem Kopf. 2. Hinter den Kopf senken. 3. Arme strecken.'),
  ('Enge Liegestütze','beginner','bodyweight','triceps','Liegestütze mit engem Griff.','1. Hände eng zusammen. 2. Absenken, Ellbogen am Körper. 3. Hochdrücken.'),
  -- Bauch
  ('Crunches','beginner','bodyweight','abs','Klassische Bauchübung.','1. Rückenlage, Knie gebeugt. 2. Oberkörper anheben. 3. Langsam senken.'),
  ('Beinheben','intermediate','bodyweight','abs','Trainiert den unteren Bauch.','1. Rückenlage. 2. Gestreckte Beine anheben. 3. Langsam senken.'),
  ('Russian Twists','intermediate','bodyweight','abs','Seitliche Bauchmuskulatur.','1. Sitzend leicht zurücklehnen. 2. Oberkörper rotieren. 3. Seite wechseln.'),
  -- Beine
  ('Goblet Squat','beginner','dumbbell','legs','Kniebeuge mit Kurzhantel vor der Brust.','1. Kurzhantel vor der Brust. 2. Tief in die Hocke. 3. Hochdrücken.'),
  ('Ausfallschritte','beginner','bodyweight','legs','Lunges für Beine und Gesäß.','1. Großer Schritt nach vorn. 2. Absenken. 3. Zurück, Seite wechseln.'),
  ('Beinpresse (Maschine)','intermediate','machine','legs','Geführte Beinübung.','1. Füße auf der Platte. 2. Wegdrücken. 3. Kontrolliert beugen.'),
  -- Waden
  ('Wadenheben (stehend)','beginner','bodyweight','calves','Waden mit dem eigenen Körpergewicht.','1. Aufrecht stehen. 2. Auf die Zehen hoch. 3. Langsam senken.'),
  ('Wadenheben (Kurzhantel)','beginner','dumbbell','calves','Waden mit Zusatzgewicht.','1. Kurzhanteln in den Händen. 2. Hochdrücken. 3. Senken.'),
  -- Gesäß
  ('Glute Bridge','beginner','bodyweight','glutes','Gesäßbrücke am Boden.','1. Rückenlage, Knie gebeugt. 2. Hüfte hochdrücken. 3. Senken.'),
  ('Hip Thrust','intermediate','barbell','glutes','Gesäßübung mit Schultern auf der Bank.','1. Schultern an der Bank. 2. Hüfte mit Gewicht hochdrücken. 3. Senken.'),
  ('Kreuzheben','advanced','barbell','glutes','Ganzkörper-Zugübung, betont Gesäß und Beinrückseite.','1. Stange vor den Schienbeinen. 2. Mit geradem Rücken heben. 3. Kontrolliert absenken.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);
