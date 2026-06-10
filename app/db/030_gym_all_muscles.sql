-- ============================================================================
--  Migration 030 - Mehr Geraete-Uebungen (Hantel/Langhantel/Kabel/Maschine), echte GIFs
--  GIFs werden client-seitig ueber app/lib/exerciseMedia.ts per NAME aufgeloest.
--  Im Supabase SQL Editor ausfuehren. Idempotent (fuegt nur fehlende ein). Optional (nur Seeds).
-- ============================================================================
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  -- BRUST
  ('Schrägbankdrücken am Kabel','intermediate','cable','chest','Brustdrücken am Kabelzug auf der Schrägbank.','1. Schrägbank zwischen die Kabeltürme stellen. 2. Griffe nach oben-innen drücken. 3. Kontrolliert öffnen.'),
  ('Schräge Kabel-Fliegende','intermediate','cable','chest','Fliegende am Kabel auf der Schrägbank – betont die obere Brust.','1. Schrägbank, Kabel tief eingestellt. 2. Arme leicht gebeugt nach oben-innen führen. 3. Langsam öffnen.'),
  ('Untere Kabel-Fliegende','intermediate','cable','chest','Fliegende von unten nach oben für die obere Brust.','1. Kabel ganz unten greifen. 2. Hände vor der Brust nach oben-innen führen. 3. Kontrolliert senken.'),
  ('Breites Bankdrücken (Langhantel)','intermediate','barbell','chest','Bankdrücken mit breitem Griff – mehr Brustdehnung.','1. Stange breiter als schulterbreit fassen. 2. Zur Brust senken. 3. Hochdrücken.'),
  ('Assistierte Brust-Dips (Maschine)','beginner','machine','chest','Geführte Dips mit Gewichtsunterstützung – ideal zum Einstieg.','1. Aufs Polster knien, Griffe fassen. 2. Vorgebeugt absenken. 3. Hochdrücken.'),
  -- RUECKEN
  ('Assistierte Klimmzüge (Maschine)','beginner','machine','back','Klimmzüge mit Gewichtsunterstützung – perfekt für Einsteiger.','1. Aufs Polster knien, Stange greifen. 2. Hochziehen. 3. Kontrolliert absenken.'),
  ('Pendlay-Rudern (Langhantel)','intermediate','barbell','back','Explosives Rudern, die Stange startet jede Wiederholung am Boden.','1. Vorgebeugt, Rücken gerade, Stange am Boden. 2. Explosiv zum Bauch ziehen. 3. Wieder ablegen.'),
  ('Langhantel-Rudern (Untergriff)','intermediate','barbell','back','Vorgebeugtes Rudern im Untergriff – betont den unteren Lat.','1. Stange im Untergriff fassen, vorbeugen. 2. Zum Bauch ziehen. 3. Kontrolliert senken.'),
  ('Langhantel-Shrugs','beginner','barbell','back','Schulterheben mit der Langhantel für den Nacken (Trapez).','1. Stange vor dem Körper halten. 2. Schultern gerade nach oben ziehen. 3. Senken.'),
  ('Überzug am Kabel (gestreckte Arme)','beginner','cable','back','Latzug mit gestreckten Armen – isoliert den breiten Rücken.','1. Hohe Kabelstange, Arme gestreckt. 2. Stange mit geraden Armen zur Hüfte ziehen. 3. Zurückführen.'),
  -- SCHULTERN
  ('Einarmiges Kabel-Seitheben','intermediate','cable','shoulders','Seitheben am Kabel mit konstanter Spannung, einarmig.','1. Unteres Kabel seitlich greifen. 2. Arm bis Schulterhöhe heben. 3. Senken, Seite wechseln.'),
  ('Reverse Flys am Kabel','intermediate','cable','shoulders','Hintere Schulter am Kabel über Kreuz.','1. Kabel über Kreuz fassen. 2. Arme nach hinten-außen ziehen. 3. Zurückführen.'),
  ('Frontheben am Kabel','beginner','cable','shoulders','Frontheben am Kabelzug für die vordere Schulter.','1. Unteres Kabel hinter dem Körper. 2. Arm nach vorn auf Schulterhöhe heben. 3. Senken.'),
  ('Thruster (Langhantel)','intermediate','barbell','shoulders','Kniebeuge mit anschließendem Schulterdrücken – Ganzkörper-Power.','1. Stange auf den Schultern, in die Hocke. 2. Hochkommen und über Kopf drücken. 3. Zurück.'),
  -- BIZEPS
  ('Drag-Curls (Langhantel)','intermediate','barbell','biceps','Curl, bei dem die Stange eng am Körper nach oben gezogen wird.','1. Stange hängend halten. 2. Ellbogen nach hinten, Stange dicht am Körper hochziehen. 3. Senken.'),
  ('Einarmige Kabel-Curls','beginner','cable','biceps','Bizeps-Curl einarmig am Kabel mit konstanter Spannung.','1. Unteres Kabel greifen. 2. Hochcurlen. 3. Langsam senken, Seite wechseln.'),
  ('Kabel-Hammer-Curls (Seil)','beginner','cable','biceps','Hammer-Curls am Seil für Bizeps und Unterarm.','1. Seil mit neutralem Griff fassen. 2. Hochcurlen. 3. Senken.'),
  ('Überkopf-Kabel-Curls','intermediate','cable','biceps','Bizeps-Curl mit seitlich ausgestreckten Armen (Doppelbizeps).','1. Beide oberen Kabel greifen, Arme seitlich. 2. Hände zum Kopf curlen. 3. Strecken.'),
  -- TRIZEPS
  ('Trizeps-Pushdown (Seil)','beginner','cable','triceps','Trizepsdrücken am Kabel mit Seil – starke Endkontraktion.','1. Seil oben fassen, Ellbogen am Körper. 2. Nach unten strecken und Seil spreizen. 3. Zurück.'),
  ('Assistierte Trizeps-Dips (Maschine)','beginner','machine','triceps','Geführte Dips mit Unterstützung, Trizepsfokus.','1. Aufs Polster knien, Griffe fassen. 2. Aufrecht absenken. 3. Hochdrücken.'),
  ('Überkopf-Trizepsdrücken (Langhantel)','intermediate','barbell','triceps','Trizepsstrecken über Kopf mit der Langhantel, sitzend.','1. Stange über dem Kopf halten. 2. Hinter den Kopf senken. 3. Wieder strecken.'),
  ('Einarmiger Trizeps-Pushdown (Kabel)','beginner','cable','triceps','Einarmiges Trizepsdrücken am Kabel.','1. Griff im Untergriff fassen, Ellbogen am Körper. 2. Nach unten strecken. 3. Zurück, Seite wechseln.'),
  -- BEINE
  ('Good Morning (Langhantel)','intermediate','barbell','legs','Hüftbeuge mit Stange im Nacken – Beinrückseite und unterer Rücken.','1. Stange im Nacken, Knie leicht gebeugt. 2. Mit geradem Rücken vorbeugen. 3. Aufrichten.'),
  ('Boxkniebeuge (Langhantel)','intermediate','barbell','legs','Kniebeuge bis zu einer Box – kontrollierte Tiefe.','1. Stange im Nacken, vor einer Box stehen. 2. Bis zur Box absenken. 3. Hochdrücken.'),
  ('Farmers Walk','beginner','dumbbell','legs','Gehen mit schweren Kurzhanteln – Beine, Rumpf und Griffkraft.','1. Schwere Kurzhanteln seitlich greifen. 2. Aufrecht gehen. 3. Kontrolliert absetzen.'),
  ('Beinbeuger mit Kurzhantel (liegend)','intermediate','dumbbell','legs','Beinrückseite, Kurzhantel zwischen den Füßen.','1. Bäuchlings auf der Bank, Kurzhantel zwischen den Füßen. 2. Fersen zum Gesäß beugen. 3. Senken.'),
  -- GESAESS
  ('Einbeiniges Kreuzheben (Langhantel)','advanced','barbell','glutes','Kreuzheben auf einem Bein – Gesäß, Beinrückseite und Balance.','1. Auf einem Bein, Stange vor dem Körper. 2. Mit geradem Rücken absenken, hinteres Bein hebt. 3. Aufrichten.'),
  ('Seitlicher Ausfallschritt (Langhantel)','intermediate','barbell','glutes','Ausfallschritt zur Seite mit Stange – Gesäß und Innenschenkel.','1. Stange im Nacken. 2. Großer Schritt zur Seite, absenken. 3. Zurückdrücken, Seite wechseln.'),
  ('Ausfallschritt rückwärts (Langhantel)','intermediate','barbell','glutes','Rückwärts-Ausfallschritt mit Stange für das Gesäß.','1. Stange im Nacken. 2. Schritt nach hinten, absenken. 3. Nach vorn zurückdrücken.'),
  ('Langhantel-Gesäßbrücke','beginner','barbell','glutes','Gesäßbrücke am Boden mit aufgelegter Langhantel.','1. Rückenlage, Stange über der Hüfte. 2. Hüfte nach oben drücken. 3. Kontrolliert senken.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);
