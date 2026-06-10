-- ============================================================================
--  Migration 029 - Mehr Koerpergewicht-Uebungen fuer ALLE Muskelgruppen (echte GIFs)
--  GIFs werden client-seitig ueber app/lib/exerciseMedia.ts per NAME aufgeloest
--  (ExerciseDB-IDs dort hinterlegt). Hier nur Uebungs-Datensaetze.
--  Im Supabase SQL Editor ausfuehren. Idempotent (fuegt nur fehlende ein). Optional (nur Seeds).
-- ============================================================================
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  -- RUECKEN
  ('Klimmzüge (Neutralgriff)','intermediate','bodyweight','back','Klimmzug mit parallelem Griff, schont die Schultern.','1. Parallelgriff fassen, Arme gestreckt. 2. Hochziehen bis das Kinn die Hände erreicht. 3. Kontrolliert absenken.'),
  ('Enger Klimmzug (paralleler Griff)','intermediate','bodyweight','back','Enger Parallelgriff-Klimmzug mit Fokus auf den unteren Lat.','1. Enge parallele Griffe fassen. 2. Brust Richtung Hände ziehen. 3. Langsam absenken.'),
  ('Klimmzug (Kammgriff)','intermediate','bodyweight','back','Klimmzug mit gemischtem Griff für mehr Zugkraft.','1. Eine Hand im Ober-, eine im Untergriff. 2. Hochziehen. 3. Absenken, Griff je Satz wechseln.'),
  ('Umgekehrtes Rudern (Knie gebeugt)','beginner','bodyweight','back','Leichtes umgekehrtes Rudern mit aufgestellten Füßen.','1. Unter einer niedrigen Stange liegen, Knie gebeugt. 2. Brust zur Stange ziehen. 3. Kontrolliert absenken.'),
  ('Einarmiges Handtuch-Rudern','beginner','bodyweight','back','Rudern mit einem Handtuch an einer stabilen Tür oder Stange – ganz ohne Geräte.','1. Handtuch um einen stabilen Pfosten legen, ein Ende fassen. 2. Zurücklehnen und heranziehen. 3. Langsam zurücklassen, Seite wechseln.'),
  ('Einarmiges Standrudern (Eigengewicht)','beginner','bodyweight','back','Stehendes einarmiges Rudern gegen den eigenen Widerstand.','1. Leicht in die Knie, Oberkörper vor. 2. Ellbogen nach hinten ziehen, Schulterblatt zusammen. 3. Strecken, Seite wechseln.'),
  ('Archer-Klimmzug','advanced','bodyweight','back','Einseitig betonter Klimmzug – Vorstufe zum einarmigen Klimmzug.','1. Sehr weiter Griff. 2. Zu einer Hand hochziehen, der andere Arm bleibt gestreckt. 3. Absenken, Seite wechseln.'),
  ('Einarmiger Klimmzug','advanced','bodyweight','back','Klimmzug auf einem Arm – maximale Rückenkraft.','1. Eine Hand an der Stange. 2. Kontrolliert hochziehen. 3. Langsam absenken, nicht schwingen.'),
  ('Muscle-up','advanced','bodyweight','back','Klimmzug mit Übergang über die Stange (Klimmzug plus Dip).','1. Explosiv hochziehen. 2. Über die Stange rollen. 3. Nach oben strecken und kontrolliert zurück.'),
  -- SCHULTERN
  ('Pike-to-Cobra-Liegestütze','intermediate','bodyweight','shoulders','Fließende Bewegung von der Pike-Position in die Kobra – fordert die Schultern.','1. In der umgekehrten V-Position starten. 2. Nach vorn-unten absenken bis in die Kobra. 3. Zurück in die Pike-Position drücken.'),
  ('Wand-Handstand (Halten)','advanced','bodyweight','shoulders','Handstand an der Wand für Kraft und Stabilität der Schultern.','1. Hände nah an der Wand, hochkicken. 2. Körper anspannen, Position halten. 3. Kontrolliert wieder absteigen.'),
  -- TRIZEPS
  ('Enge Schräg-Liegestütze','beginner','bodyweight','triceps','Enge Liegestütze mit erhöhten Händen – leichter für Einsteiger.','1. Hände eng auf einer Erhöhung. 2. Brust zur Kante senken, Ellbogen am Körper. 3. Hochdrücken.'),
  ('Enge Liegestütze (auf Knien)','beginner','bodyweight','triceps','Enge Liegestütze auf den Knien – sanfter Einstieg für den Trizeps.','1. Auf den Knien, Hände eng. 2. Oberkörper absenken, Ellbogen nah am Körper. 3. Hochdrücken.'),
  ('Trizeps-Strecken kniend (Eigengewicht)','beginner','bodyweight','triceps','Trizeps-Strecken aus dem Knien gegen das eigene Gewicht.','1. Kniend, Oberkörper aufrecht. 2. Aus den Ellbogen nach vorn-unten absenken. 3. Mit dem Trizeps wieder hochdrücken.'),
  ('Seitliche Liegestütze','intermediate','bodyweight','triceps','Liegestütze in Seitlage – isoliert je einen Trizeps.','1. Auf der Seite liegen, Hand vor der Brust. 2. Oberkörper hochdrücken. 3. Langsam senken, Seite wechseln.'),
  ('Trizeps-Dips (Stuhl)','intermediate','bodyweight','triceps','Dips an einem Stuhl oder einer Bank für den Trizeps.','1. Hände auf die Kante, Beine vorgestreckt. 2. Körper absenken, Ellbogen nach hinten. 3. Hochdrücken.'),
  ('Einarmige Dips','advanced','bodyweight','triceps','Dips auf einem Arm – sehr anspruchsvolle Trizepsübung.','1. Eine Hand auf einer stabilen Kante. 2. Körper kontrolliert absenken. 3. Hochdrücken, Seite wechseln.'),
  -- BAUCH
  ('Dead Bug (Käfer)','beginner','bodyweight','abs','Stabilitätsübung für die tiefe Bauchmuskulatur.','1. Rückenlage, Arme und Beine angehoben. 2. Gegenüberliegenden Arm und Bein absenken. 3. Zurück, Seite wechseln.'),
  ('Über-Kreuz-Crunch','beginner','bodyweight','abs','Crunch mit Drehung für die schrägen Bauchmuskeln.','1. Rückenlage, Hände am Kopf. 2. Ellbogen zum gegenüberliegenden Knie führen. 3. Zurück, Seite wechseln.'),
  ('Seitlicher Crunch (Boden)','beginner','bodyweight','abs','Crunch zur Seite für die seitliche Bauchmuskulatur.','1. Rückenlage, Beine zur Seite gekippt. 2. Oberkörper gerade anheben. 3. Senken.'),
  ('Umgekehrter Crunch','beginner','bodyweight','abs','Hebt das Becken an – betont den unteren Bauch.','1. Rückenlage, Beine angewinkelt. 2. Knie zur Brust ziehen, Becken anheben. 3. Kontrolliert senken.'),
  ('Fersen-Tipper','beginner','bodyweight','abs','Seitliches Antippen der Fersen für die Taille.','1. Rückenlage, Knie gebeugt. 2. Abwechselnd seitlich zur Ferse greifen. 3. Mitte halten.'),
  ('Ellbogen zum Knie','beginner','bodyweight','abs','Crunch über Kreuz, Ellbogen trifft das gegenüberliegende Knie.','1. Hände am Kopf. 2. Ellbogen und gegenüberliegendes Knie zusammenführen. 3. Strecken, Seite wechseln.'),
  ('Inchworm (Raupe)','beginner','bodyweight','abs','Dynamische Ganzkörper- und Rumpfübung.','1. Vorbeugen, Hände am Boden. 2. Mit den Händen in den Stütz wandern. 3. Zurücklaufen und aufrichten.'),
  ('Crunch auf der Schrägbank','intermediate','bodyweight','abs','Crunch mit erhöhtem Widerstand auf der Negativbank.','1. Auf der Schrägbank fixieren. 2. Oberkörper einrollen. 3. Kontrolliert zurück.'),
  ('Plank mit Drehung','intermediate','bodyweight','abs','Unterarmstütz mit Hüftdrehung für die seitliche Bauchmuskulatur.','1. Unterarmstütz. 2. Hüfte abwechselnd zur Seite drehen, fast den Boden berühren. 3. Mitte halten.'),
  ('Klappmesser (Jackknife)','intermediate','bodyweight','abs','Gleichzeitiges Anheben von Armen und Beinen.','1. Rückenlage, Arme über Kopf. 2. Hände und Füße über der Mitte zusammenführen. 3. Kontrolliert senken.'),
  ('Cocoons','intermediate','bodyweight','abs','Knie zur Brust mit Einrollen des Oberkörpers.','1. Rückenlage, Arme über Kopf. 2. Knie zur Brust ziehen und einrollen. 3. Strecken.'),
  ('L-Sit am Boden','advanced','bodyweight','abs','Statisches Halten mit gestreckten Beinen – starke Rumpfspannung.','1. Hände neben der Hüfte am Boden. 2. Körper hochdrücken, Beine gestreckt anheben. 3. Position halten.'),
  ('V-Sit am Boden','advanced','bodyweight','abs','Balance-Halt in V-Form für den gesamten Bauch.','1. Sitzen, leicht zurücklehnen. 2. Beine gestreckt anheben (V-Form). 3. Halten, Balance bewahren.'),
  -- BEINE
  ('Kniebeuge mit Überkopf-Streckung','beginner','bodyweight','legs','Kniebeuge mit gleichzeitigem Strecken der Arme nach oben.','1. In die Hocke gehen. 2. Hochkommen und Arme über den Kopf strecken. 3. Wiederholen.'),
  ('Schnelle Füße (Quick Feet)','beginner','bodyweight','legs','Schnelle Trippelschritte für Kondition und Beine.','1. Leicht in die Knie. 2. Füße sehr schnell abwechselnd auf und ab tippen. 3. Tempo halten.'),
  ('Standweitsprung','intermediate','bodyweight','legs','Explosiver Sprung nach vorn aus dem Stand.','1. In die Hocke gehen, Arme zurück. 2. Kräftig nach vorn springen. 3. Weich auf beiden Füßen landen.'),
  ('Assistierter Beinbeuger','intermediate','bodyweight','legs','Beinrückseite über die Absenkphase, mit Handabstützung.','1. Kniend, Füße fixiert. 2. Langsam nach vorn absenken, mit den Händen abfangen. 3. Zurückdrücken.'),
  ('Glute-Ham-Raise','advanced','bodyweight','legs','Anspruchsvolle Übung für die hintere Oberschenkelmuskulatur.','1. Füße fixiert, Oberkörper aufrecht. 2. Kontrolliert nach vorn absenken. 3. Mit der Beinrückseite zurückziehen.'),
  ('Einbeinige Kniebeuge','advanced','bodyweight','legs','Kniebeuge auf einem Bein für Kraft und Balance.','1. Auf einem Bein stehen, anderes nach vorn. 2. Kontrolliert in die Hocke. 3. Auf einem Bein hochdrücken.'),
  -- GESAESS
  ('Monster Walk','beginner','bodyweight','glutes','Seitliche Schritte in der Hocke – aktiviert das Gesäß.','1. Leichte Kniebeuge-Position. 2. Seitliche Schritte gehen, Spannung halten. 3. Richtung wechseln.'),
  ('Beckenkippen zur Brücke','beginner','bodyweight','glutes','Sanftes Aufrollen in die Gesäßbrücke.','1. Rückenlage, Knie gebeugt. 2. Becken kippen und Wirbel für Wirbel anheben. 3. Kontrolliert abrollen.'),
  ('Curtsey-Kniebeuge','intermediate','bodyweight','glutes','Knicks-Ausfallschritt für Gesäß und seitliche Oberschenkel.','1. Ein Bein diagonal nach hinten kreuzen. 2. Absenken. 3. Hochdrücken, Seite wechseln.'),
  ('Sprung-Ausfallschritt','intermediate','bodyweight','glutes','Explosive Ausfallschritte mit Sprung und Beinwechsel.','1. Im Ausfallschritt absenken. 2. Hochspringen und Beine wechseln. 3. Weich landen.'),
  ('Pistol Squat (einbeinig)','advanced','bodyweight','glutes','Tiefe einbeinige Kniebeuge – Königsdisziplin für Beine und Gesäß.','1. Auf einem Bein stehen, anderes gestreckt nach vorn. 2. Tief in die Hocke. 3. Kontrolliert hochdrücken.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);
