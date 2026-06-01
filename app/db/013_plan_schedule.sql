-- ============================================================================
--  Migration 013 - Wochenplan: Wochentag -> Plan-Tag zuordnen
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--  weekday: 0 = Montag ... 6 = Sonntag. Pro Nutzer & Wochentag genau ein Plan-Tag.
-- ============================================================================
create table if not exists public.plan_schedule (
  user_id     uuid not null references auth.users(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),
  plan_day_id uuid not null references public.workout_plan_days(id) on delete cascade,
  primary key (user_id, weekday)
);
create index if not exists plan_schedule_day_idx on public.plan_schedule(plan_day_id);

alter table public.plan_schedule enable row level security;
drop policy if exists "plan_schedule_all_own" on public.plan_schedule;
create policy "plan_schedule_all_own" on public.plan_schedule for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
