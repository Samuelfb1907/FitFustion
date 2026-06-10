-- ============================================================================
--  Migration 034 - profiles.is_premium gegen Client-Aenderungen schuetzen
--  Im Supabase SQL Editor ausfuehren. Idempotent (mehrfach ausfuehrbar).
--
--  Problem: Bisher konnte jeder eingeloggte Nutzer per Supabase-REST sein eigenes
--  profiles.is_premium auf true setzen und sich so kostenlos Premium freischalten.
--
--  Loesung: Ein BEFORE-UPDATE-Trigger setzt eine vom Client (Rollen 'authenticated'
--  oder 'anon') versuchte Aenderung von is_premium wieder auf den alten Wert zurueck.
--  Server-seitige Rollen (service_role / RevenueCat-Webhook) und Admin (postgres)
--  duerfen is_premium weiterhin setzen.
-- ============================================================================

create or replace function public.prevent_is_premium_change()
returns trigger
language plpgsql
as $$
begin
  if new.is_premium is distinct from old.is_premium
     and current_user in ('authenticated', 'anon')
  then
    new.is_premium := old.is_premium;  -- Aenderungsversuch durch den Client ignorieren
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_premium on public.profiles;
create trigger trg_protect_is_premium
  before update on public.profiles
  for each row
  execute function public.prevent_is_premium_change();
