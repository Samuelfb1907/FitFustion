-- ============================================================================
--  Migration 004 – Noch mehr Übungen je Muskelgruppe (Varianten für jedes Equipment)
--  Im Supabase SQL Editor ausführen. Idempotent: fügt nur fehlende Übungen ein.
-- ============================================================================
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  -- Brust
  ('Kurzhantel-Fliegende','intermediate','dumbbell','chest','Isolationsübung für die Brust (Flys).','1. Rücklings auf der Bank. 2. Arme leicht gebeugt zur Seite öffnen. 3. Über der Brust zusammenführen.'),
  ('Kabelzug-Crossover','intermediate','cable','chest','Brust-Isolation am Kabelzug.','1. Griffe oben fassen. 2. Vor dem Körper zusammenführen. 3. Kontrolliert öffnen.'),
  ('Dips (Barren)','advanced','bodyweight','chest','Anspruchsvolle Übung für untere Brust und Trizeps.','1. An Barren stützen. 2. Oberkörper leicht vorgebeugt absenken. 3. Hochdrücken.'),
  ('Schräg-Liegestütze','beginner','bodyweight','chest','Leichtere Liegestütze mit erhöhten Händen.','1. Hände auf einer erhöhten Fläche. 2. Körper gerade absenken. 3. Hochdrücken.'),
  -- Rücken
  ('Langhantel-Rudern','intermediate','barbell','back','Grundübung für den mittleren Rücken.','1. Vorgebeugt, Rücken gerade. 2. Stange zum Bauch ziehen. 3. Kontrolliert senken.'),
  ('Kabelrudern (sitzend)','beginner','cable','back','Geführtes Rudern am Kabelzug.','1. Sitzend, Griff fassen. 2. Zum Bauch ziehen. 3. Langsam zurückführen.'),
  ('Negativ-Klimmzüge','intermediate','bodyweight','back','Einstieg in Klimmzüge über die Absenkphase.','1. Oben starten (hochspringen). 2. Sehr langsam absenken. 3. Wiederholen.'),
  ('Face Pulls','beginner','cable','back','Für oberen Rücken und hintere Schulter.','1. Seil auf Gesichtshöhe. 2. Zum Gesicht ziehen. 3. Kontrolliert zurück.'),
  -- Schultern
  ('Frontheben','beginner','dumbbell','shoulders','Trainiert die vordere Schulter.','1. Kurzhanteln vor den Oberschenkeln. 2. Nach vorn bis Schulterhöhe heben. 3. Senken.'),
  ('Arnold-Press','intermediate','dumbbell','shoulders','Schulterdrücken mit Rotation.','1. Handflächen zum Körper. 2. Beim Drücken nach außen drehen. 3. Zurück.'),
  ('Langhantel-Schulterdrücken','intermediate','barbell','shoulders','Drücken über Kopf mit der Langhantel.','1. Stange auf Schulterhöhe. 2. Über Kopf drücken. 3. Kontrolliert senken.'),
  ('Reverse Flys','beginner','dumbbell','shoulders','Trainiert die hintere Schulter.','1. Vorgebeugt, leichte Kurzhanteln. 2. Arme zur Seite öffnen. 3. Senken.'),
  ('Schulter-Taps','beginner','bodyweight','shoulders','Stabilität für Schulter und Rumpf.','1. Liegestützposition. 2. Abwechselnd Schulter antippen. 3. Hüfte ruhig halten.'),
  -- Bizeps
  ('Konzentrationscurls','beginner','dumbbell','biceps','Isolierte Bizepsübung.','1. Sitzend, Ellbogen am Oberschenkel. 2. Hochcurlen. 3. Langsam senken.'),
  ('SZ-Stangen-Curls','intermediate','barbell','biceps','Bizeps mit der SZ-Stange (gelenkschonend).','1. SZ-Stange greifen. 2. Hochcurlen. 3. Senken.'),
  ('Kabel-Curls','beginner','cable','biceps','Konstante Spannung am Kabelzug.','1. Unteres Kabel greifen. 2. Hochcurlen. 3. Kontrolliert zurück.'),
  ('Chin-ups','advanced','bodyweight','biceps','Klimmzug mit Untergriff, starker Bizepsreiz.','1. Untergriff, schulterbreit. 2. Hochziehen bis Kinn über Stange. 3. Absenken.'),
  ('Isometrische Curls (Handtuch)','beginner','bodyweight','biceps','Bizeps ohne Geräte über Eigenwiderstand.','1. Handtuch unter den Fuß. 2. Gegen Widerstand curlen. 3. Spannung halten.'),
  -- Trizeps
  ('Trizeps-Pushdown (Kabel)','beginner','cable','triceps','Trizeps am Kabelzug.','1. Oberes Kabel greifen. 2. Nach unten strecken. 3. Kontrolliert zurück.'),
  ('Stirndrücken (SZ-Stange)','intermediate','barbell','triceps','Liegendes Trizepsdrücken.','1. Rücklings, Stange über der Stirn. 2. Zur Stirn senken. 3. Strecken.'),
  ('Kickbacks','beginner','dumbbell','triceps','Trizeps-Isolation.','1. Vorgebeugt, Oberarm parallel zum Boden. 2. Unterarm nach hinten strecken. 3. Zurück.'),
  -- Bauch
  ('Mountain Climbers','beginner','bodyweight','abs','Dynamische Bauch- und Cardioübung.','1. Liegestützposition. 2. Knie abwechselnd zur Brust. 3. Tempo halten.'),
  ('Bicycle Crunches','intermediate','bodyweight','abs','Gerade und seitliche Bauchmuskeln.','1. Rückenlage. 2. Ellbogen zum gegenüberliegenden Knie. 3. Seiten wechseln.'),
  ('Hängendes Knieheben','advanced','bodyweight','abs','Unterer Bauch, an der Stange hängend.','1. An der Stange hängen. 2. Knie zur Brust heben. 3. Langsam senken.'),
  ('Seitstütz','beginner','bodyweight','abs','Statische Übung für die seitliche Bauchmuskulatur.','1. Seitlich auf den Unterarm stützen. 2. Hüfte anheben. 3. Halten, Seite wechseln.'),
  -- Beine
  ('Rumänisches Kreuzheben','intermediate','barbell','legs','Betont die Beinrückseite (Hamstrings).','1. Stange nah am Körper. 2. Hüfte nach hinten, Rücken gerade. 3. Wieder aufrichten.'),
  ('Beinstrecker (Maschine)','beginner','machine','legs','Isolation für den vorderen Oberschenkel.','1. Auf der Maschine sitzen. 2. Beine strecken. 3. Kontrolliert beugen.'),
  ('Beinbeuger (Maschine)','beginner','machine','legs','Isolation für die Beinrückseite.','1. Auf der Maschine. 2. Fersen anziehen. 3. Langsam zurück.'),
  ('Bulgarian Split Squat','advanced','dumbbell','legs','Einbeinige Kniebeuge, hinterer Fuß erhöht.','1. Hinterer Fuß auf der Bank. 2. Tief absenken. 3. Hochdrücken, Seite wechseln.'),
  ('Wandsitz','beginner','bodyweight','legs','Statische Halteübung für die Oberschenkel.','1. Rücken an die Wand. 2. In die Hocke (ca. 90 Grad). 3. Position halten.'),
  -- Waden
  ('Wadenheben sitzend (Maschine)','beginner','machine','calves','Sitzendes Wadenheben, betont den tiefen Wadenmuskel.','1. Polster auf den Knien. 2. Auf die Zehen hoch. 3. Senken.'),
  ('Eselwadenheben','beginner','bodyweight','calves','Wadenheben in vorgebeugter Position.','1. Vorgebeugt abstützen. 2. Auf die Zehen hoch. 3. Senken.'),
  ('Einbeiniges Wadenheben','intermediate','bodyweight','calves','Einbeinig für mehr Intensität.','1. Auf einem Bein stehen. 2. Hochdrücken. 3. Langsam senken, Seite wechseln.'),
  ('Wadenheben (Langhantel)','intermediate','barbell','calves','Stehendes Wadenheben mit der Langhantel.','1. Stange auf dem Rücken. 2. Auf die Zehen hoch. 3. Senken.'),
  -- Gesäß
  ('Ausfallschritte rückwärts','beginner','bodyweight','glutes','Lunges nach hinten, betont das Gesäß.','1. Schritt nach hinten. 2. Absenken. 3. Zurück, Seite wechseln.'),
  ('Kabel-Kickbacks','beginner','cable','glutes','Gesäß-Isolation am Kabelzug.','1. Fußmanschette am Kabel. 2. Bein nach hinten strecken. 3. Zurück.'),
  ('Sumo-Kniebeuge','intermediate','dumbbell','glutes','Breite Kniebeuge, betont Gesäß und Innenschenkel.','1. Breiter Stand. 2. Tief absenken. 3. Hochdrücken.'),
  ('Einbeinige Glute Bridge','intermediate','bodyweight','glutes','Einbeinige Gesäßbrücke.','1. Rückenlage, ein Bein gestreckt. 2. Hüfte hochdrücken. 3. Senken, Seite wechseln.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);
