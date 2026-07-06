-- ============================================================================
--  Migration 067 - Push bei Kudos/Kommentar SERVERSEITIG (Phase 1c)
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Bisher loeste der Client des Reagierenden den Push aus (notify-social) -> fragil,
--  wenn dessen App-Version das Update nicht hat. Jetzt loest ein DB-Trigger den Push
--  direkt aus (via pg_net an den Expo-Push-Dienst) - unabhaengig von der App-Version.
--  Nie Selbst-Push; ohne Push-Token still. Exception-Handler: ein Push-Fehler darf den
--  Kommentar/Kudos-Insert NIE blockieren. Baut auf 062 (Kudos)/063 (Kommentare)/046 (Token).
-- ============================================================================
create extension if not exists pg_net;

create or replace function public.tg_push_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; tok text; nm text;
begin
  select e.user_id into owner from public.activity_events e where e.id = NEW.event_id;
  if owner is null or owner = NEW.user_id then return NEW; end if;               -- kein Selbst-Push
  select token into tok from public.push_tokens where user_id = owner limit 1;
  if tok is null then return NEW; end if;                                        -- kein Token -> In-App reicht
  select coalesce(nullif(first_name, ''), 'Ein Freund') into nm from public.profiles where id = NEW.user_id;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object('to', tok, 'title', 'FitAvo',
              'body', nm || ': „' || left(NEW.body, 100) || '"',
              'sound', 'default',
              'data', jsonb_build_object('type', 'social', 'eventId', NEW.event_id))
  );
  return NEW;
exception when others then
  return NEW;                                                                    -- Push-Fehler blockt Insert nie
end; $$;

drop trigger if exists trg_push_on_comment on public.activity_comments;
create trigger trg_push_on_comment after insert on public.activity_comments
  for each row execute function public.tg_push_on_comment();

create or replace function public.tg_push_on_kudos() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; tok text; nm text;
begin
  select e.user_id into owner from public.activity_events e where e.id = NEW.event_id;
  if owner is null or owner = NEW.user_id then return NEW; end if;
  select token into tok from public.push_tokens where user_id = owner limit 1;
  if tok is null then return NEW; end if;
  select coalesce(nullif(first_name, ''), 'Ein Freund') into nm from public.profiles where id = NEW.user_id;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object('to', tok, 'title', 'FitAvo',
              'body', nm || ' hat dir ein 🔥 gegeben',
              'sound', 'default',
              'data', jsonb_build_object('type', 'social', 'eventId', NEW.event_id))
  );
  return NEW;
exception when others then
  return NEW;
end; $$;

drop trigger if exists trg_push_on_kudos on public.activity_kudos;
create trigger trg_push_on_kudos after insert on public.activity_kudos
  for each row execute function public.tg_push_on_kudos();
