# Datenbank-Migrationen (Supabase)

Alle `.sql`-Dateien werden **manuell** im Supabase **SQL Editor** ausgeführt
(Dashboard → SQL Editor → New query → einfügen → Run). Sie sind **idempotent**
(mehrfaches Ausführen schadet nicht) und müssen **in dieser Reihenfolge** laufen:

| Reihenfolge | Datei | Inhalt |
|---|---|---|
| 1 | `schema.sql` | Basis: profiles, goals, muscles, exercises, workout_* , progress_entries, RLS |
| 2 | `002_allergies.sql` | Allergie-Felder |
| 3 | `003_more_exercises.sql` | Mehr Übungen |
| 4 | `004_more_exercises.sql` | Mehr Übungen |
| 5 | `005_food_tracking.sql` | foods + food_logs (Tracker) |
| 6 | `006_foods_500plus.sql` | ~500 Lebensmittel-Seed |
| 7 | `007_session_end.sql` | workout_sessions.ended_at |
| 8 | `008_more_exercises_gifs.sql` | Übungen + GIF-Bezug |
| 9 | `009_water.sql` | water_logs |
| 10 | `010_recipes.sql` | (aktuell ungenutzt) Rezepte/Pläne |
| 11 | `011_barcode.sql` | Barcode-Felder für foods |
| 12 | `012_meal_types.sql` | meal_type in food_logs |
| 13 | `013_plan_schedule.sql` | Wochenplan: Wochentag → Plan-Tag |
| 14 | `014_gdpr.sql` | DSGVO-Hilfen |
| 15 | `015_privacy_indexes.sql` | Indizes + restriktive foods-Policy |
| 16 | `016_integrity.sql` | Unique-/Integritäts-Constraints |
| 17 | `017_leaderboard.sql` | leaderboard_entries (opt-in Bestenliste) |
| 18 | `018_audit_fixes.sql` | FK-Korrektur, set_logs-Indizes/Unique, foods-Policy |
| 19 | `019_drop_unused.sql` | Ungenutzte Tabellen entfernt (recipes/recipe_items/nutrition_plans/meals) |
| 20 | `020_drop_allergies.sql` | Allergie-Spalte aus profiles entfernt (Datenminimierung) |
| 21 | `021_leaderboard_view.sql` | Leaderboard-View (is_me statt fremder UUIDs) |
| 22 | `022_meal_favorites.sql` | Favoriten (gespeicherte Mahlzeiten) für den Essens-Tracker |
| 23 | `023_hardening.sql` | Härtung (Audit): Leaderboard-UUID-Leak schließen (View), Werte-/Bereichs-CHECKs |
| 24 | `024_leaderboard_trust.sql` | Leaderboard-Punkte serverseitig per Trigger (fälschungssicher) + Mengen-Limits |
| 25 | `025_consent.sql` | Server-seitiger Einwilligungs-Nachweis (profiles.disclaimer_version + consented_at) |
| 26 | `026_ai_consent.sql` | KI-Einwilligung (profiles.ai_consent_at) |
| 27 | `027_ai_rate_limit.sql` | Tageslimit für KI-Analysen (ai_usage + bump_ai_usage) |
| 28 | `028_more_chest_bodyweight.sql` | Mehr Brust-Übungen (Körpergewicht) |
| 29 | `029_bodyweight_all_muscles.sql` | Körpergewichts-Übungen für alle Muskeln |
| 30 | `030_gym_all_muscles.sql` | Geräte-Übungen für alle Muskeln |
| 31 | `031_equipment_recategorize.sql` | „Kein Equipment" strikt (Geräte → equipment 'other') |
| 32 | `032_exercises_max.sql` | Großer Übungs-Ausbau (+230) |
| 33 | `033_premium.sql` | profiles.is_premium (Abo-Status) |
| 34 | `034_protect_is_premium.sql` | is_premium gegen Client-Änderungen schützen (UPDATE-Trigger) |
| 35 | `035_protect_is_premium_insert.sql` | is_premium-Schutz auf INSERT erweitern (DELETE+INSERT-Lücke schließen) |

## Hinweise
- **Reihenfolge zählt:** Spätere Migrationen bauen auf früheren auf.
- Es gibt **bewusst kein `001`** (historisch); Start ist immer `schema.sql`.
- `foods` wird in 005/006 angelegt **und** in 015 mit einer restriktiven
  Lese-Policy versehen – nach erneutem Seeden von 006 ggf. 015/018 erneut laufen lassen.
- Neue Migration? Datei `0XX_kurzbeschreibung.sql` anlegen, hier eintragen,
  idempotent schreiben (`create table if not exists`, `drop policy if exists`, …).
