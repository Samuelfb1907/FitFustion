-- ============================================================================
--  Migration 035 - is_premium auch bei INSERT gegen Client schuetzen
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Migration 034 schuetzte nur BEFORE UPDATE. Da Nutzer ihr Profil per RLS auch
--  loeschen + neu einfuegen koennen, liess sich der Schutz mit DELETE +
--  INSERT(is_premium=true) umgehen. Dieser Trigger zwingt is_premium bei INSERT
--  durch Client-Rollen (authenticated/anon) auf false und blockt weiterhin
--  Aenderungen bei UPDATE. Server-Rollen (service_role / Webhook) und Admin
--  (sowie der SECURITY-DEFINER-Trigger handle_new_user) bleiben unberuehrt.
-- ============================================================================

create or replace function public.prevent_is_premium_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_premium := false;            -- Client darf sich nicht selbst premium anlegen
    elsif tg_op = 'UPDATE' and new.is_premium is distinct from old.is_premium then
      new.is_premium := old.is_premium;   -- Client darf is_premium nicht aendern
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_premium on public.profiles;
create trigger trg_protect_is_premium
  before insert or update on public.profiles
  for each row
  execute function public.prevent_is_premium_change();
