-- ============================================================================
--  Migration 064 - Cardio als Feed-Ereignistyp (Phase 1b)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Erweitert activity_events.type um 'cardio', damit eine eingetragene Cardio-Einheit
--  (CardioTab) als Aktivitaet im Freunde-Feed erscheinen kann. log_activity laesst den
--  neuen Typ ebenfalls zu (gleiche 6h-Anti-Spam-Regel). Baut auf Migration 048 auf.
-- ============================================================================
alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check
  check (type in ('trained', 'record', 'cardio'));

create or replace function public.log_activity(p_type text, p_detail text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d text := left(coalesce(p_detail, ''), 60);
begin
  if p_type not in ('trained', 'record', 'cardio') then return; end if;
  if exists (
    select 1 from public.activity_events
    where user_id = auth.uid() and type = p_type and coalesce(detail, '') = d
      and created_at > now() - interval '6 hours'
  ) then
    return;
  end if;
  insert into public.activity_events(user_id, type, detail) values (auth.uid(), p_type, nullif(d, ''));
end; $$;
revoke all on function public.log_activity(text, text) from public, anon;
grant execute on function public.log_activity(text, text) to authenticated;
