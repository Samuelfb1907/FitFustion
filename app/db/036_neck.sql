-- ============================================================================
--  Migration 036 – Muskelgruppe "Nacken" (Trapez) + GIF-belegte Shrug-Uebungen
--  Im Supabase SQL Editor ausfuehren. Idempotent / re-run-sicher.
--  Es werden NUR Uebungen zugeordnet, die ein animiertes GIF besitzen
--  (vorhandene Shrugs/Schulterheben aus Migration 030/032).
-- ============================================================================

insert into public.muscles (key, name_de, name_en, body_region) values
  ('neck', 'Nacken', 'Neck', 'upper')
on conflict (key) do nothing;

update public.exercises
set primary_muscle_id = (select id from public.muscles where key = 'neck'),
    description = 'Schulterheben (Shrug) für den Nacken bzw. Trapezmuskel.',
    instructions = '1. Gewicht hängen lassen, Arme gestreckt, Schultern locker. 2. Schultern gerade nach oben Richtung Ohren ziehen. 3. Oben kurz halten, dann kontrolliert absenken.'
where name in (
  'Langhantel-Shrugs',
  'Kurzhantel Shrugs',
  'Kurzhantel Negativ Shrugs',
  'Kurzhantel Schräg Shrugs',
  'Smith Shrugs',
  'Smith Rücken Shrugs',
  'Band Shrugs'
);

-- ============================================================================
--  FERTIG. Pruefen mit:
--    select m.name_de, count(e.id) from public.muscles m
--    left join public.exercises e on e.primary_muscle_id = m.id
--    where m.key = 'neck' group by m.name_de;   -- erwartet: 7
-- ============================================================================
