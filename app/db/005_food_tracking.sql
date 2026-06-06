-- ============================================================================
--  Migration 005 – Kalorien-Tracker: Zutaten-Datenbank (foods) + Tagebuch (food_logs)
--  Im Supabase SQL Editor ausführen. Idempotent.
--  Alle Nährwerte sind PRO 100 g.
-- ============================================================================

-- Zutaten-Referenztabelle (für alle lesbar)
create table if not exists public.foods (
  id       uuid primary key default gen_random_uuid(),
  name     text unique not null,
  category text,
  kcal     numeric not null,
  protein  numeric not null default 0,
  carbs    numeric not null default 0,
  fat      numeric not null default 0
);

-- Tagebuch-Einträge (pro Nutzer)
create table if not exists public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  food_id    uuid not null references public.foods(id),
  log_date   date not null default current_date,
  amount_g   numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date_idx on public.food_logs(user_id, log_date);

-- RLS
alter table public.foods enable row level security;
-- Lese-Policy datenschutzfreundlich: globale Foods (user_id is null) fuer alle,
-- eigene/gescannte nur fuer den Besitzer. Faellt auf "alle lesbar" zurueck, solange
-- die user_id-Spalte (Migration 011) noch nicht existiert -> re-run-sicher.
drop policy if exists "foods_read_all" on public.foods;
do $$
begin
  drop policy if exists "foods_read_global_or_own" on public.foods;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='foods' and column_name='user_id') then
    create policy "foods_read_global_or_own" on public.foods
      for select to authenticated using (user_id is null or auth.uid() = user_id);
  else
    create policy "foods_read_global_or_own" on public.foods
      for select to authenticated using (true);
  end if;
end $$;

alter table public.food_logs enable row level security;
drop policy if exists "food_logs_all_own" on public.food_logs;
create policy "food_logs_all_own" on public.food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
--  Zutaten (pro 100 g): name, category, kcal, protein, carbs, fat
-- ============================================================================
insert into public.foods (name, category, kcal, protein, carbs, fat) values
  -- Fleisch & Wurst
  ('Hähnchenbrust', 'Fleisch', 165, 31, 0, 3.6),
  ('Hähnchenschenkel', 'Fleisch', 209, 26, 0, 11),
  ('Putenbrust', 'Fleisch', 135, 30, 0, 1),
  ('Rindersteak', 'Fleisch', 250, 26, 0, 15),
  ('Rinderhackfleisch', 'Fleisch', 250, 26, 0, 17),
  ('Hackfleisch gemischt', 'Fleisch', 230, 18, 0, 18),
  ('Schweinefilet', 'Fleisch', 143, 26, 0, 4),
  ('Schweineschnitzel', 'Fleisch', 196, 22, 0, 12),
  ('Lammfleisch', 'Fleisch', 250, 25, 0, 16),
  ('Kochschinken', 'Fleisch', 110, 18, 1, 3),
  ('Salami', 'Fleisch', 380, 22, 1, 32),
  ('Speck', 'Fleisch', 540, 12, 0, 53),
  ('Bratwurst', 'Fleisch', 300, 13, 2, 27),
  -- Fisch & Meeresfrüchte
  ('Lachs', 'Fisch', 208, 20, 0, 13),
  ('Thunfisch (Dose, Wasser)', 'Fisch', 110, 26, 0, 1),
  ('Thunfisch (frisch)', 'Fisch', 130, 28, 0, 1),
  ('Forelle', 'Fisch', 120, 20, 0, 4),
  ('Kabeljau', 'Fisch', 82, 18, 0, 0.7),
  ('Garnelen', 'Fisch', 99, 24, 0, 0.3),
  ('Hering', 'Fisch', 210, 18, 0, 15),
  ('Fischstäbchen', 'Fisch', 200, 12, 18, 9),
  -- Eier & Milchprodukte
  ('Ei', 'Eier & Milch', 155, 13, 1, 11),
  ('Eiklar', 'Eier & Milch', 52, 11, 0.7, 0.2),
  ('Magerquark', 'Eier & Milch', 67, 12, 4, 0.3),
  ('Speisequark 20%', 'Eier & Milch', 110, 12, 3, 5),
  ('Skyr', 'Eier & Milch', 63, 11, 4, 0.2),
  ('Naturjoghurt 3,5%', 'Eier & Milch', 61, 3.5, 5, 3.5),
  ('Griechischer Joghurt', 'Eier & Milch', 130, 5, 4, 10),
  ('Hüttenkäse', 'Eier & Milch', 98, 11, 3, 4),
  ('Vollmilch 3,5%', 'Eier & Milch', 64, 3.4, 4.8, 3.6),
  ('Milch 1,5%', 'Eier & Milch', 47, 3.4, 4.9, 1.5),
  ('Gouda', 'Eier & Milch', 356, 25, 0, 27),
  ('Mozzarella', 'Eier & Milch', 280, 18, 1, 22),
  ('Feta', 'Eier & Milch', 264, 14, 4, 21),
  ('Frischkäse', 'Eier & Milch', 250, 6, 3, 24),
  ('Parmesan', 'Eier & Milch', 392, 36, 0, 27),
  ('Butter', 'Eier & Milch', 717, 0.9, 0.7, 81),
  ('Sahne', 'Eier & Milch', 290, 2.5, 3, 30),
  -- Getreide & Beilagen
  ('Reis (gekocht)', 'Getreide & Beilagen', 130, 2.7, 28, 0.3),
  ('Vollkornreis (gekocht)', 'Getreide & Beilagen', 110, 2.6, 23, 0.9),
  ('Nudeln (gekocht)', 'Getreide & Beilagen', 158, 6, 31, 1),
  ('Vollkornnudeln (gekocht)', 'Getreide & Beilagen', 150, 6, 27, 1.5),
  ('Kartoffeln (gekocht)', 'Getreide & Beilagen', 87, 2, 20, 0.1),
  ('Süßkartoffel', 'Getreide & Beilagen', 86, 1.6, 20, 0.1),
  ('Pommes frites', 'Getreide & Beilagen', 290, 3.4, 38, 14),
  ('Haferflocken', 'Getreide & Beilagen', 370, 13, 60, 7),
  ('Weißbrot', 'Getreide & Beilagen', 265, 9, 49, 3),
  ('Vollkornbrot', 'Getreide & Beilagen', 220, 9, 38, 3),
  ('Toastbrot', 'Getreide & Beilagen', 270, 9, 50, 4),
  ('Brötchen', 'Getreide & Beilagen', 280, 9, 53, 3),
  ('Quinoa (gekocht)', 'Getreide & Beilagen', 120, 4.4, 21, 1.9),
  ('Couscous (gekocht)', 'Getreide & Beilagen', 112, 3.8, 23, 0.2),
  ('Müsli', 'Getreide & Beilagen', 360, 9, 60, 8),
  ('Cornflakes', 'Getreide & Beilagen', 380, 7, 84, 1),
  -- Hülsenfrüchte
  ('Linsen (gekocht)', 'Hülsenfrüchte', 116, 9, 20, 0.4),
  ('Kichererbsen (gekocht)', 'Hülsenfrüchte', 164, 9, 27, 2.6),
  ('Kidneybohnen (gekocht)', 'Hülsenfrüchte', 127, 8.7, 22, 0.5),
  ('Erbsen', 'Hülsenfrüchte', 81, 5, 14, 0.4),
  ('Tofu', 'Hülsenfrüchte', 144, 15, 3, 9),
  ('Tempeh', 'Hülsenfrüchte', 190, 19, 9, 11),
  -- Gemüse
  ('Brokkoli', 'Gemüse', 34, 2.8, 7, 0.4),
  ('Tomate', 'Gemüse', 18, 0.9, 3.9, 0.2),
  ('Gurke', 'Gemüse', 15, 0.7, 3.6, 0.1),
  ('Karotte', 'Gemüse', 41, 0.9, 10, 0.2),
  ('Paprika', 'Gemüse', 31, 1, 6, 0.3),
  ('Zwiebel', 'Gemüse', 40, 1.1, 9, 0.1),
  ('Spinat', 'Gemüse', 23, 2.9, 3.6, 0.4),
  ('Zucchini', 'Gemüse', 17, 1.2, 3.1, 0.3),
  ('Champignons', 'Gemüse', 22, 3.1, 3.3, 0.3),
  ('Blumenkohl', 'Gemüse', 25, 1.9, 5, 0.3),
  ('Kopfsalat', 'Gemüse', 15, 1.4, 2.9, 0.2),
  ('Mais (Dose)', 'Gemüse', 86, 3.2, 19, 1.2),
  ('Avocado', 'Gemüse', 160, 2, 9, 15),
  ('Aubergine', 'Gemüse', 25, 1, 6, 0.2),
  ('Grüne Bohnen', 'Gemüse', 31, 1.8, 7, 0.1),
  ('Rote Bete', 'Gemüse', 43, 1.6, 10, 0.2),
  -- Obst
  ('Apfel', 'Obst', 52, 0.3, 14, 0.2),
  ('Banane', 'Obst', 89, 1.1, 23, 0.3),
  ('Orange', 'Obst', 47, 0.9, 12, 0.1),
  ('Erdbeeren', 'Obst', 32, 0.7, 8, 0.3),
  ('Blaubeeren', 'Obst', 57, 0.7, 14, 0.3),
  ('Himbeeren', 'Obst', 52, 1.2, 12, 0.7),
  ('Trauben', 'Obst', 69, 0.7, 18, 0.2),
  ('Birne', 'Obst', 57, 0.4, 15, 0.1),
  ('Ananas', 'Obst', 50, 0.5, 13, 0.1),
  ('Mango', 'Obst', 60, 0.8, 15, 0.4),
  ('Kiwi', 'Obst', 61, 1.1, 15, 0.5),
  ('Wassermelone', 'Obst', 30, 0.6, 8, 0.2),
  ('Datteln', 'Obst', 282, 2.5, 75, 0.4),
  ('Rosinen', 'Obst', 299, 3, 79, 0.5),
  -- Nüsse, Samen & Fette
  ('Mandeln', 'Nüsse & Fette', 579, 21, 22, 50),
  ('Walnüsse', 'Nüsse & Fette', 654, 15, 14, 65),
  ('Cashewkerne', 'Nüsse & Fette', 553, 18, 30, 44),
  ('Haselnüsse', 'Nüsse & Fette', 628, 15, 17, 61),
  ('Erdnüsse', 'Nüsse & Fette', 567, 26, 16, 49),
  ('Erdnussbutter', 'Nüsse & Fette', 588, 25, 20, 50),
  ('Chiasamen', 'Nüsse & Fette', 486, 17, 42, 31),
  ('Leinsamen', 'Nüsse & Fette', 534, 18, 29, 42),
  ('Olivenöl', 'Nüsse & Fette', 884, 0, 0, 100),
  ('Rapsöl', 'Nüsse & Fette', 884, 0, 0, 100),
  ('Kokosöl', 'Nüsse & Fette', 862, 0, 0, 100),
  -- Snacks & Süßes
  ('Vollmilchschokolade', 'Snacks & Süßes', 535, 8, 59, 30),
  ('Zartbitterschokolade', 'Snacks & Süßes', 546, 8, 46, 38),
  ('Kartoffelchips', 'Snacks & Süßes', 536, 7, 53, 34),
  ('Gummibärchen', 'Snacks & Süßes', 343, 7, 77, 0.2),
  ('Kekse', 'Snacks & Süßes', 480, 6, 64, 22),
  ('Vanilleeis', 'Snacks & Süßes', 207, 3.5, 24, 11),
  ('Proteinriegel', 'Snacks & Süßes', 350, 30, 30, 12),
  ('Honig', 'Snacks & Süßes', 304, 0.3, 82, 0),
  ('Marmelade', 'Snacks & Süßes', 250, 0.4, 62, 0.1),
  ('Nuss-Nougat-Creme', 'Snacks & Süßes', 539, 6, 57, 31),
  ('Zucker', 'Snacks & Süßes', 400, 0, 100, 0),
  -- Getränke
  ('Cola', 'Getränke', 42, 0, 11, 0),
  ('Orangensaft', 'Getränke', 45, 0.7, 10, 0.2),
  ('Apfelsaft', 'Getränke', 46, 0.1, 11, 0.1),
  ('Bier', 'Getränke', 43, 0.5, 3.6, 0),
  ('Rotwein', 'Getränke', 85, 0.1, 2.6, 0),
  ('Mandelmilch', 'Getränke', 13, 0.4, 0.3, 1.1),
  ('Hafermilch', 'Getränke', 45, 1, 7, 1.5),
  ('Whey-Proteinpulver', 'Getränke', 400, 80, 8, 6),
  -- Fertiggerichte & Sonstiges
  ('Pizza Margherita', 'Fertiggerichte', 250, 11, 30, 9),
  ('Döner', 'Fertiggerichte', 215, 14, 16, 10),
  ('Hamburger', 'Fertiggerichte', 250, 13, 20, 13),
  ('Sushi', 'Fertiggerichte', 140, 5, 28, 1),
  ('Ketchup', 'Sonstiges', 110, 1.2, 26, 0.1),
  ('Mayonnaise', 'Sonstiges', 680, 1, 1, 75),
  ('Hummus', 'Sonstiges', 177, 8, 14, 10),
  ('Pesto', 'Sonstiges', 450, 5, 6, 45)
on conflict (name) do nothing;
