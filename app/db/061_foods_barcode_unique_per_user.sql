-- ============================================================================
--  Migration 061 - Barcode-Scanner-Bugfix Teil 2: barcode-Eindeutigkeit pro Nutzer
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Wie 060 fuer den Namen: der Barcode war GLOBAL eindeutig (foods_barcode_idx).
--  Hatte ein anderer Nutzer einen Barcode bereits privat gescannt, konnte ein neuer
--  Nutzer ihn nicht anlegen (23505), die fremde private Zeile ist per RLS unsichtbar,
--  Fallback scheitert -> "Konnte das Produkt nicht abrufen". Loesung: Eindeutigkeit
--  pro (barcode, user_id).
-- ============================================================================
drop index if exists public.foods_barcode_idx;
create unique index if not exists foods_barcode_user_uidx
  on public.foods (barcode, user_id) where barcode is not null;
