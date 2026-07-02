-- ============================================================================
--  Migration 058 – Mehr Übungen OHNE Equipment für Nacken & Bizeps
--  Im Supabase SQL Editor ausführen. Idempotent / re-run-sicher.
--  Bisher: Nacken = nur Shrugs (alle mit Gerät); Bizeps ohne Gerät sehr dünn.
--  Neu: 6 Nacken- + 5 Bizeps-Übungen mit equipment='bodyweight' (global, created_by NULL).
--  Zeigt sich auch für "Kein Equipment"-Nutzer. Ohne GIF -> Fallback statt Animation.
-- ============================================================================

insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select v.name, v.difficulty, v.equipment, m.id, v.description, v.instructions
from (values
  -- ---- Nacken (neck) ----
  ('Nacken-Isometrie vorne (Handwiderstand)','beginner','bodyweight','neck',
   'Nackenbeuger – ganz ohne Geräte über den eigenen Handwiderstand.',
   '1. Handflächen an die Stirn legen. 2. Kopf leicht nach vorne drücken und mit den Händen dagegenhalten. 3. Spannung 5–10 Sek. halten, dann locker lassen.'),
  ('Nacken-Isometrie hinten (Handwiderstand)','beginner','bodyweight','neck',
   'Nackenstrecker über Eigenwiderstand.',
   '1. Hände an den Hinterkopf legen. 2. Kopf nach hinten drücken, mit den Händen dagegenhalten. 3. 5–10 Sek. halten, dann lösen.'),
  ('Nacken-Isometrie seitlich (Handwiderstand)','beginner','bodyweight','neck',
   'Seitliche Nackenmuskulatur – beide Seiten gleich oft.',
   '1. Handfläche an die Schläfe legen. 2. Kopf zur Seite drücken, mit der Hand dagegenhalten. 3. 5–10 Sek. halten, Seite wechseln.'),
  ('Nacken-Rotation mit Handwiderstand','beginner','bodyweight','neck',
   'Dreh-Muskeln des Nackens über Eigenwiderstand.',
   '1. Handfläche an die Wange legen. 2. Kopf gegen die Hand zur Seite drehen wollen, dagegenhalten. 3. 5–10 Sek. halten, Seite wechseln.'),
  ('Schulterheben ohne Gewicht','beginner','bodyweight','neck',
   'Trapez/Nacken ohne Gewicht – gut zum Aufwärmen oder für zuhause.',
   '1. Aufrecht stehen, Arme locker hängen. 2. Schultern kräftig Richtung Ohren ziehen. 3. Oben 2 Sek. anspannen, langsam senken.'),
  ('Nacken-Strecker in Bauchlage','intermediate','bodyweight','neck',
   'Kräftigt den hinteren Nacken über das Eigengewicht des Kopfes.',
   '1. In Bauchlage, Stirn Richtung Boden. 2. Kopf langsam anheben, bis der Nacken gerade ist. 3. Kurz halten, kontrolliert absenken – nicht ins Hohlkreuz kommen.'),
  -- ---- Bizeps (biceps) ----
  ('Selbstwiderstand-Curl (Handwiderstand)','beginner','bodyweight','biceps',
   'Bizeps ganz ohne Geräte – eine Hand arbeitet gegen die andere.',
   '1. Eine Hand nach oben curlen. 2. Mit der anderen Hand von oben dagegendrücken. 3. Langsam hoch- und runterführen, dann Arm wechseln.'),
  ('Isometrischer Bizeps-Halt','beginner','bodyweight','biceps',
   'Statische Bizepsspannung ohne Gewicht.',
   '1. Unterarm im 90-Grad-Winkel. 2. Faust gegen die andere Handfläche drücken und den Bizeps fest anspannen. 3. 10–20 Sek. halten, Seite wechseln.'),
  ('Wasserflaschen-Curl','beginner','bodyweight','biceps',
   'Bizeps-Curl mit vollen Wasserflaschen als Kurzhantel-Ersatz.',
   '1. In jede Hand eine volle Flasche (0,5–1,5 L). 2. Arme hängen lassen, dann zur Schulter curlen. 3. Kontrolliert absenken.'),
  ('Rucksack-Curl','beginner','bodyweight','biceps',
   'Bizeps mit einem beladenen Rucksack – so schwer wie du brauchst.',
   '1. Rucksack mit Büchern oder Flaschen füllen. 2. Am oberen Griff fassen, Arm hängen lassen. 3. Zur Schulter curlen, langsam senken, Arm wechseln.'),
  ('Untertisch-Curl (isometrisch)','beginner','bodyweight','biceps',
   'Isometrischer Bizeps über den Widerstand einer schweren Tischplatte.',
   '1. Sitzend die Handflächen unter eine schwere Tischplatte legen. 2. Nach oben ziehen, als wolltest du den Tisch heben. 3. 10–20 Sek. anspannen, dann lösen.')
) as v(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = v.muscle_key
where not exists (select 1 from public.exercises e where e.name = v.name);

-- ============================================================================
--  Prüfen mit:
--    select m.name_de, e.equipment, count(*) from public.exercises e
--    join public.muscles m on m.id = e.primary_muscle_id
--    where m.key in ('neck','biceps') and e.equipment = 'bodyweight'
--    group by m.name_de, e.equipment;
-- ============================================================================
