-- ============================================================================
--  Migration 039 - Koerpermasse (Umfaenge in cm) je Nutzer
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  Eine Zeile = eine Messung an einem Datum; alle Umfangs-Felder optional
--  (nur Ausgefuelltes). Bereichs-CHECKs gegen offensichtlich falsche Werte.
-- ============================================================================
create table if not exists public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  measured_on  date not null default (now() at time zone 'Europe/Berlin')::date,
  waist_cm     numeric(5,1) check (waist_cm is null or (waist_cm >= 20 and waist_cm <= 300)),
  chest_cm     numeric(5,1) check (chest_cm is null or (chest_cm >= 20 and chest_cm <= 300)),
  hips_cm      numeric(5,1) check (hips_cm  is null or (hips_cm  >= 20 and hips_cm  <= 300)),
  arm_cm       numeric(5,1) check (arm_cm   is null or (arm_cm   >= 10 and arm_cm   <= 150)),
  thigh_cm     numeric(5,1) check (thigh_cm is null or (thigh_cm >= 10 and thigh_cm <= 200)),
  created_at   timestamptz not null default now()
);
create index if not exists body_measurements_user_idx on public.body_measurements(user_id, measured_on desc);

alter table public.body_measurements enable row level security;
drop policy if exists "body_measurements_all_own" on public.body_measurements;
create policy "body_measurements_all_own" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
