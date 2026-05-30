-- ============================================================================
--  FitFusion – Datenbank-Schema (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
--  SO FÜHRST DU ES AUS:
--    1. Supabase-Dashboard öffnen -> linke Leiste: "SQL Editor"
--    2. "New query" -> diesen GESAMTEN Inhalt einfügen -> "Run" (Strg+Enter)
--
--  Das Skript ist idempotent (mehrfach ausführbar): vorhandene Objekte werden
--  nicht doppelt angelegt. Row Level Security (RLS) sorgt dafür, dass jeder
--  Nutzer ausschliesslich seine EIGENEN Daten sehen/ändern kann.
-- ============================================================================

create extension if not exists pgcrypto; -- für gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1) PROFILE  (1:1 zur eingebauten Tabelle auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  first_name           text,
  birth_date           date,
  gender               text check (gender in ('male','female','diverse','prefer_not')),
  height_cm            numeric(5,1),
  weight_kg            numeric(5,1),
  activity_level       text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  experience_level     text check (experience_level in ('beginner','some','advanced','pro')),
  training_environment text check (training_environment in ('gym','home_gym','no_equipment')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2) ZIELE
-- ----------------------------------------------------------------------------
create table if not exists public.goals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  goal_type        text not null check (goal_type in
                     ('lose_weight','build_muscle','gain_strength','endurance','general_fitness','get_defined')),
  target_weight_kg numeric(5,1),
  target_date      date,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id);

-- ----------------------------------------------------------------------------
-- 3) MUSKELN  (Referenzdaten – für alle lesbar)
-- ----------------------------------------------------------------------------
create table if not exists public.muscles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name_de     text not null,
  name_en     text,
  body_region text
);

-- ----------------------------------------------------------------------------
-- 4) ÜBUNGEN  (Referenzdaten)
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  difficulty        text not null check (difficulty in ('beginner','intermediate','advanced')),
  equipment         text not null check (equipment in ('barbell','dumbbell','machine','cable','bodyweight','none','other')),
  primary_muscle_id uuid references public.muscles(id),
  description       text,
  instructions      text,
  created_at        timestamptz not null default now()
);
create index if not exists exercises_primary_muscle_idx on public.exercises(primary_muscle_id);

-- Sekundäre Zielmuskeln (n:m-Beziehung)
create table if not exists public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id   uuid not null references public.muscles(id) on delete cascade,
  role        text not null default 'secondary' check (role in ('primary','secondary')),
  primary key (exercise_id, muscle_id)
);

-- ----------------------------------------------------------------------------
-- 5) TRAININGSPLÄNE
-- ----------------------------------------------------------------------------
create table if not exists public.workout_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Mein Plan',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists workout_plans_user_idx on public.workout_plans(user_id);

create table if not exists public.workout_plan_days (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  plan_id   uuid not null references public.workout_plans(id) on delete cascade,
  day_index int not null,
  focus     text
);
create index if not exists workout_plan_days_plan_idx on public.workout_plan_days(plan_id);

create table if not exists public.workout_plan_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_day_id  uuid not null references public.workout_plan_days(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  target_sets  int default 3,
  target_reps  int default 10,
  order_index  int default 0
);
create index if not exists wpe_plan_day_idx on public.workout_plan_exercises(plan_day_id);

-- ----------------------------------------------------------------------------
-- 6) TRAININGS-SESSIONS & SATZ-PROTOKOLL
-- ----------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan_day_id  uuid references public.workout_plan_days(id) on delete set null,
  performed_at timestamptz not null default now(),
  notes        text
);
create index if not exists sessions_user_idx on public.workout_sessions(user_id);

create table if not exists public.set_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  session_id       uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id      uuid not null references public.exercises(id),
  set_index        int not null default 1,
  reps             int,
  weight_kg        numeric(6,2),
  duration_seconds int,
  created_at       timestamptz not null default now()
);
create index if not exists set_logs_session_idx on public.set_logs(session_id);

-- ----------------------------------------------------------------------------
-- 7) ERNÄHRUNG
-- ----------------------------------------------------------------------------
create table if not exists public.nutrition_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  plan_date       date not null default current_date,
  calories_target int,
  protein_g       int,
  carbs_g         int,
  fat_g           int,
  created_at      timestamptz not null default now()
);
create index if not exists nutrition_user_idx on public.nutrition_plans(user_id);

create table if not exists public.meals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  nutrition_plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  meal_type         text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  name              text not null,
  calories          int,
  protein_g         int,
  carbs_g           int,
  fat_g             int
);
create index if not exists meals_plan_idx on public.meals(nutrition_plan_id);

-- ----------------------------------------------------------------------------
-- 8) FORTSCHRITT (Gewichtsverlauf)
-- ----------------------------------------------------------------------------
create table if not exists public.progress_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  weight_kg  numeric(5,1),
  created_at timestamptz not null default now()
);
create index if not exists progress_user_idx on public.progress_entries(user_id);

-- ----------------------------------------------------------------------------
-- 9) GAMIFICATION
-- ----------------------------------------------------------------------------
create table if not exists public.achievements (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  icon        text
);

create table if not exists public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at      timestamptz not null default now(),
  unique (user_id, achievement_id)
);
create index if not exists user_ach_user_idx on public.user_achievements(user_id);

-- ============================================================================
--  TRIGGER
-- ============================================================================

-- Bei jeder Registrierung automatisch ein leeres Profil anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, new.raw_user_meta_data->>'first_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatisch aktualisieren (für profiles)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
--  ROW LEVEL SECURITY (RLS)
--  -> Jeder Nutzer sieht/ändert NUR seine eigenen Daten.
-- ============================================================================

-- profiles: Eigentümer = auth.uid() == id
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Alle Tabellen mit Spalte user_id: vollständiger Zugriff nur für den Eigentümer
do $$
declare t text;
begin
  foreach t in array array[
    'goals','workout_plans','workout_plan_days','workout_plan_exercises',
    'workout_sessions','set_logs','nutrition_plans','meals',
    'progress_entries','user_achievements'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_all_own" on public.%I;', t, t);
    execute format(
      'create policy "%s_all_own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t);
  end loop;
end$$;

-- Referenzdaten (Muskeln/Übungen/Achievements): für alle LESBAR, Schreiben nur per Admin
do $$
declare t text;
begin
  foreach t in array array['muscles','exercises','exercise_muscles','achievements']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_read_all" on public.%I;', t, t);
    execute format('create policy "%s_read_all" on public.%I for select using (true);', t, t);
  end loop;
end$$;

-- ============================================================================
--  BEISPIEL-DATEN (Seed)
-- ============================================================================

-- 9 Muskelgruppen
insert into public.muscles (key, name_de, name_en, body_region) values
  ('chest',    'Brust',     'Chest',     'upper'),
  ('back',     'Rücken',    'Back',      'upper'),
  ('shoulders','Schultern', 'Shoulders', 'upper'),
  ('biceps',   'Bizeps',    'Biceps',    'upper'),
  ('triceps',  'Trizeps',   'Triceps',   'upper'),
  ('abs',      'Bauch',     'Abs',       'core'),
  ('legs',     'Beine',     'Legs',      'lower'),
  ('calves',   'Waden',     'Calves',    'lower'),
  ('glutes',   'Gesäß',     'Glutes',    'lower')
on conflict (key) do nothing;

-- Ein paar Beispiel-Übungen (Muskel per key zugeordnet)
insert into public.exercises (name, difficulty, equipment, primary_muscle_id, description, instructions)
select e.name, e.difficulty, e.equipment, m.id, e.description, e.instructions
from (values
  ('Liegestütze', 'beginner',     'bodyweight', 'chest', 'Klassische Eigengewichtsübung für die Brust.', '1. Hände schulterbreit. 2. Körper gerade absenken. 3. Hochdrücken.'),
  ('Bankdrücken', 'intermediate', 'barbell',    'chest', 'Grundübung für die Brustmuskulatur.',          '1. Flach auf die Bank. 2. Stange zur Brust. 3. Kontrolliert drücken.'),
  ('Klimmzüge',   'advanced',     'bodyweight', 'back',  'Zugübung für den oberen Rücken.',               '1. Breiter Griff. 2. Hochziehen bis Kinn über Stange. 3. Absenken.'),
  ('Kniebeuge',   'intermediate', 'barbell',    'legs',  'Grundübung für Beine und Gesäß.',               '1. Stange auf dem Rücken. 2. Tief in die Hocke. 3. Hochdrücken.'),
  ('Plank',       'beginner',     'bodyweight', 'abs',   'Statische Übung für die Rumpfmuskulatur.',      '1. Unterarmstütz. 2. Körper gerade halten. 3. Position halten.')
) as e(name, difficulty, equipment, muscle_key, description, instructions)
join public.muscles m on m.key = e.muscle_key
where not exists (select 1 from public.exercises x where x.name = e.name);

-- Beispiel-Achievements
insert into public.achievements (key, name, description, icon) values
  ('first_workout', 'Erstes Workout', 'Dein erstes Training abgeschlossen.', '🏋️'),
  ('streak_7',      '7-Tage-Streak',  '7 Tage in Folge aktiv gewesen.',      '🔥'),
  ('first_goal',    'Etappenziel',    'Ein erstes Ziel erreicht.',           '🎯')
on conflict (key) do nothing;

-- ============================================================================
--  FERTIG. Prüfen mit:  select * from public.muscles;
-- ============================================================================
