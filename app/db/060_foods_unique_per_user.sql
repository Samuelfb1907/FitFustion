-- ============================================================================
--  Migration 060 - Barcode-Scanner-Bugfix: foods-Eindeutigkeit pro Nutzer
--  Im Supabase SQL Editor ausfuehren. Idempotent.
--
--  Problem: foods sind PRIVAT (user_id gesetzt) ODER global (user_id null). Die alte
--  Regel UNIQUE(name) war GLOBAL. Dadurch konnte ein Nutzer ein gescanntes Produkt nicht
--  anlegen, wenn ein ANDERER Nutzer es bereits privat gescannt hatte: Namens-Kollision
--  (23505), die fremde private Zeile ist per RLS unsichtbar, der Fallback (byBarcode/byName
--  in resolveBarcodeFood) findet sie nicht -> Ergebnis: "Konnte das Produkt nicht abrufen".
--  Je mehr Nutzer, desto mehr betroffene Produkte.
--
--  Loesung: Eindeutigkeit pro (name, user_id) statt global. Jeder Nutzer darf seine eigene
--  Kopie eines Produkts haben; globale Eintraege (user_id null) bleiben unberuehrt.
-- ============================================================================
alter table public.foods drop constraint if exists foods_name_key;
create unique index if not exists foods_name_user_uidx on public.foods (name, user_id);
