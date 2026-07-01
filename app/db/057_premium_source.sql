-- ============================================================================
--  Migration 057 - Premium-Quelle nachvollziehbar machen
--  Im Supabase SQL Editor ausfuehren. Idempotent. ADDITIV.
--
--  profiles.premium_source haelt fest, WOHER Premium kommt:
--    'revenuecat' = echter Kauf (wird vom revenuecat-webhook automatisch gesetzt)
--    'manual'     = von Hand freigeschaltet (Tester/Bekannte)
--    NULL         = kein/kein bekanntes Premium
--  So laesst sich "gekauft" vs. "manuell" jederzeit sauber unterscheiden.
--
--  HINWEIS: Beim MANUELLEN Freischalten kuenftig immer mitsetzen, z. B.:
--    update public.profiles set is_premium = true, premium_source = 'manual' where id = '...';
--  Der Backfill der Bestandsdaten (bekannter Kauf -> revenuecat, Rest -> manual)
--  wurde einmalig separat ausgefuehrt und ist bewusst NICHT in dieser Datei
--  (keine echten Nutzer-IDs im Repo).
-- ============================================================================
alter table public.profiles
  add column if not exists premium_source text
    check (premium_source in ('manual', 'revenuecat'));
