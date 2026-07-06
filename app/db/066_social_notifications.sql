-- ============================================================================
--  Migration 066 - "Aktivitaet bei dir" / Benachrichtigungen (Phase 1c)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Zeigt, WER auf MEINE Aktivitaeten reagiert hat: Kudos + Kommentare von anderen auf
--  Ereignisse, die mir gehoeren (letzte 30 Tage, neueste zuerst). is_new = seit meinem
--  letzten Ansehen (profiles.social_seen_at). mark_social_seen() setzt den Marker.
--  Baut auf 062 (Kudos) + 063 (Kommentare) auf. Nur eigene Reaktionen (SECURITY DEFINER).
-- ============================================================================
alter table public.profiles add column if not exists social_seen_at timestamptz;

create or replace function public.my_social_notifications()
returns table (kind text, actor_name text, event_id uuid, event_type text,
               event_detail text, body text, created_at timestamptz, is_new boolean)
language sql security definer set search_path = public stable as $$
  select k.kind,
         coalesce(nullif(p.first_name, ''), 'FitAvo-Freund') as actor_name,
         k.event_id, e.type as event_type, e.detail as event_detail, k.body, k.created_at,
         (k.created_at > coalesce((select social_seen_at from public.profiles where id = auth.uid()),
                                  'epoch'::timestamptz)) as is_new
  from (
    select 'kudos'::text as kind, ku.user_id as actor_id, ku.event_id, null::text as body, ku.created_at
    from public.activity_kudos ku
    join public.activity_events ev on ev.id = ku.event_id
    where ev.user_id = auth.uid() and ku.user_id <> auth.uid()
      and ku.created_at >= now() - interval '30 days'
    union all
    select 'comment'::text, cm.user_id, cm.event_id, cm.body, cm.created_at
    from public.activity_comments cm
    join public.activity_events ev on ev.id = cm.event_id
    where ev.user_id = auth.uid() and cm.user_id <> auth.uid()
      and cm.created_at >= now() - interval '30 days'
  ) k
  join public.activity_events e on e.id = k.event_id
  join public.profiles p on p.id = k.actor_id
  order by k.created_at desc
  limit 40;
$$;
revoke all on function public.my_social_notifications() from public, anon;
grant execute on function public.my_social_notifications() to authenticated;

create or replace function public.mark_social_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set social_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.mark_social_seen() from public, anon;
grant execute on function public.mark_social_seen() to authenticated;
