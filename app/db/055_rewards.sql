-- ============================================================================
--  Migration 055 - Belohnungen: geschenkte Streak-Freezes
--  Im Supabase SQL Editor ausfuehren. Idempotent. ADDITIV (nur neue RPC).
--
--  grant_freeze(n): schenkt dem Nutzer n zusaetzliche Streak-Freeze-Tokens
--  (gedeckelt bei 4, damit nicht gehortet wird). Wird vom Client genau einmal
--  je NEU verdientem Abzeichen aufgerufen (siehe lib/badges.ts). SECURITY DEFINER,
--  laeuft als Eigentuemer (postgres) -> der is_premium-Schutz-Trigger (Migr. 034)
--  greift nicht. Die woechentliche Freeze-Logik aus touch_streak bleibt unveraendert;
--  geschenkte Freezes sind fuer die laufende Woche nutzbar.
-- ============================================================================
create or replace function public.grant_freeze(p_n int default 1)
returns int language plpgsql security definer set search_path = public as $$
declare new_tokens int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.profiles
    set streak_freeze_tokens = least(4, coalesce(streak_freeze_tokens, 0) + greatest(0, coalesce(p_n, 0)))
    where id = auth.uid()
    returning streak_freeze_tokens into new_tokens;
  return coalesce(new_tokens, 0);
end; $$;
revoke all on function public.grant_freeze(int) from public, anon;
grant execute on function public.grant_freeze(int) to authenticated;
