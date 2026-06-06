# FitFusion – Gesamt-Audit & To-Do-Liste

> Erstellt durch einen Multi-Agent-Audit (26 Agenten: 1 Karte, 6 Dimensionen, kritische/hohe Funde gegen den echten Code verifiziert).
> Schweregrade = **verifizierte** Einstufung (nach Gegenprüfung). Status: Stand des Audits, noch nichts davon umgesetzt.

## Gesamtbild

Der **App-Code ist erstaunlich solide**: `tsc` ist fehlerfrei, alle 14 Screens sind end-to-end verdrahtet, die Kern-Logik (Kalorien nach Mifflin-St-Jeor, Gamification, Wochentage) ist korrekt, RLS ist auf jeder Nutzer-Tabelle aktiv, alle Migrationen sind idempotent, und Fehler werden meist abgefangen (selten harte Crashes). Die wichtigsten Baustellen liegen in **Setup-Doku, Datenschutz/DSGVO, Robustheit (Offline), Bestätigungen bei Löschungen, Barrierefreiheit und Performance bei langen Listen / Tab-Remounts**.

| Bereich | Ampel | Kurzfazit |
|---|---|---|
| Funktionalität & Konzept | 🟢 | Alles real implementiert; Lücke: Allergie-System unvollständig |
| Code & Architektur | 🟡 | Sauber strukturiert; Zeitzonen-Bug, Race Condition, viel Duplikation |
| User-Experience | 🟡 | Konsistentes Design; Bestätigungen & Offline-/Retry-Konzept ergänzt; A11y teils ergänzt |
| Cybersecurity & Datenschutz | 🟠 | Kein Konto-Löschen (DSGVO), API-Key im Client, E-Mail unbestätigt |
| Datenmodell & Migrationen | 🟡 | Solide; foods-Lese-Policy zu offen, fehlende Indizes |
| Performance & Stabilität | 🟡 | Lange Listen ohne Virtualisierung, Tab-Remount lädt alles neu |

---

## 🔴 Sofort (vor weiterem Ausbau – klein & wirkungsvoll)

- [x] **Setup-Doku korrigiert** ✅ – README & HANDOVER listen jetzt die vollständige Migrationskette **002–015** in Reihenfolge; `EXPO_PUBLIC_EXERCISEDB_KEY` (optional) im Setup ergänzt. *(README.md, HANDOVER.md)*
- [x] **foods-Lese-Policy eingeschränkt** ✅ – Migration 015: `foods_read_global_or_own` (`user_id is null or auth.uid() = user_id`, nur `authenticated`). Eigene/gescannte Lebensmittel sind nicht mehr für fremde Nutzer sichtbar. *(db/015_privacy_indexes.sql)*
- [x] **Allergie-Versprechen gelöst** ✅ – Allergene werden jetzt **automatisch aus den Zutaten** abgeleitet (`lib/allergens.ts`, Zutat→Allergen-Map) und mit den manuellen Tags vereinigt; `safeMealsFor` filtert darüber. Damit greifen auch zutatenbasierte Allergene wie Banane/Apfel/Weizen/Mais/Soja/Nüsse/Fisch/Kokos/Sesam/Zitrus/Nachtschatten. UI-Text ehrlich gemacht („nach Möglichkeit ausgeschlossen – bitte Zutaten selbst prüfen") + Hinweis, wenn eine Mahlzeit wegen Allergien wegfällt. *(Rein zutatenferne Intoleranzen wie Histamin/Fruktose/Sulfite bleiben naturgemäß ungefiltert.)* *(lib/allergens.ts, lib/meals.ts, NutritionScreen.tsx)*

## 🟠 Wichtig (vor einer Veröffentlichung)

### Sicherheit & Datenschutz
- [x] **DSGVO: Konto- & Datenlöschung + Export** ✅ – In **Einstellungen → Datenschutz**: „Meine Daten exportieren" (JSON-Datei teilen, Art. 15/20), „Datenschutzerklärung" (Vorlage), „Konto & alle Daten löschen" (Art. 17, mit Bestätigung). Löschen wischt alle Datenzeilen client-seitig + meldet ab; optionale Edge Function `delete-account` (service_role) entfernt zusätzlich das Auth-Konto (Cascade). Migration 014 erlaubt Profil-Löschung. *Offen: Edge Function deployen (SUPABASE_FUNCTIONS.md), Platzhalter in Datenschutzerklärung/Impressum ausfüllen, anwaltliche Prüfung.* *(SettingsScreen.tsx, lib/gdpr.ts, db/014, supabase/functions/delete-account)*
- [~] **ExerciseDB/RapidAPI-Key aus dem Client nehmen** – **Code fertig ✅**: Edge-Function-Proxy `exercisedb-image` (Key serverseitig) + Client nutzt ihn automatisch, sobald `EXPO_PUBLIC_EXERCISEDB_PROXY=1` gesetzt ist (sonst unverändert, nichts bricht). **Offen (nur du):** Funktion deployen, Key bei RapidAPI **rotieren** + Spend-Limit setzen, EAS-Env umstellen – Schritt-für-Schritt in `SUPABASE_FUNCTIONS.md`. *(supabase/functions/exercisedb-image, components/ExerciseGif.tsx, ExerciseDetail.tsx)*
- [ ] **E-Mail-Bestätigung aktivieren** – aktuell aus → Registrierung mit fremden Adressen möglich, Reset untergraben. → In Supabase-Auth „Confirm email" an; Mindest-Passwortlänge erhöhen (clientseitig **≥8 Zeichen ✅ ergänzt**; „Confirm email" + Server-Mindestlänge bleiben offen – nur du). *(Supabase-Einstellung, AuthScreen.tsx)*

### Robustheit & UX
- [x] **Offline-/Fehler-Konzept** ✅ ERLEDIGT (neu: `lib/errors.ts` + `components/ErrorRetry.tsx`; `try/catch/finally`, Fehler-Ansicht „Erneut versuchen" & **Pull-to-Refresh** auf allen 6 Hauptscreens; stiller Reload ohne Spinner-Flackern bei Reiter-Wechsel) – früheres Problem: Ladefunktionen ohne `try/catch/finally` → bei Netzfehler **endloser Spinner** ohne Meldung/Retry (Home, Tracker, Progress, Water, Training, Plan). → in `try/finally` kapseln (`setLoading(false)` im finally), Fehlerzustand + „Erneut versuchen", **Pull-to-Refresh** (RefreshControl). *(HomeScreen, FoodTrackerScreen, ProgressScreen, WaterScreen, TrainingScreen, PlanScreen)*
- [x] **Destruktive Aktionen bestätigt** ✅ – „Neuen Plan erstellen" fragt jetzt nach, wenn ein Plan existiert (ersetzt Plan+Wochenzuordnung); Gewichts-Eintrag-Löschen mit Bestätigung. *(Tagebuch-Einträge bleiben bewusst ohne Rückfrage – einzeln & leicht neu eintragbar; Rezepte entfernt.)* *(PlanScreen, ProgressScreen)*
- [x] **App-Anzeigename „FitFusion"** ✅ – `app.json` `name` = „FitFusion". *(app.json)*
- [x] **Dark Mode durchziehen** ✅ – `userInterfaceStyle: "automatic"` (native Dialoge folgen dem System). *(app.json)*
- [x] **„Passwort vergessen?" im Login** ✅ – Link im AuthScreen (sendet Reset-Mail an die eingegebene Adresse). *(AuthScreen.tsx)*
- [~] **Allergien im Profil editierbar** – hinfällig: Ernährungsplan entfernt, Allergie-Angaben werden aktuell nirgends mehr verwendet. *(ggf. Allergie-Schritt im Onboarding später ganz entfernen)*

### Korrektheit
- [x] **Zeitzonen-Bug behoben** ✅ – neuer `lib/date.ts` mit `localDateStr()`; UTC-`performed_at` wird vor dem Vergleich in die lokale Zeitzone umgerechnet (HomeScreen, ProgressScreen, ExerciseProgress). Streak/Heute/Woche stimmen jetzt um Mitternacht. *(lib/date.ts)*
- [x] **Profil-Geburtsdatum erhalten** ✅ – beim Speichern bleibt das ursprüngliche Datum erhalten, wenn das Alter unverändert ist (kein Sprung auf 01.01., kein Kalorienziel-Drift). *(ProfileScreen.tsx)*
- [x] **Doppelter Satz verhindert** ✅ – synchroner `useRef`-Lock in `saveSet` (greift sofort beim Doppel-Tipp, vor dem async-State). *(Optionaler DB-`unique(session_id,exercise_id,set_index)` nicht gesetzt, da bestehende Daten kollidieren könnten.)* *(ExerciseDetail.tsx)*

### Performance
- [x] **Lange Listen virtualisieren** ✅ – Lebensmittel-Auswahl auf `FlatList` umgestellt (nur sichtbare Zeilen, `initialNumToRender`/`windowSize`/`removeClippedSubviews`), `filteredFoods` + `makeStyles` per `useMemo`. Behebt die ~1s-Verzögerung beim „+". *(FoodTrackerScreen.tsx)*
- [x] **Tab-Remount entschärft** ✅ – Bereiche bleiben gemountet (Sichtbarkeits-Umschaltung, faul nachgeladen) → Wechsel ist sofort. Per `focusTick` (lib/useFocusTick) springt der Reiter beim Antippen auf seine Startansicht zurück und lädt die Daten **leise** neu (kein Spinner). *(MainTabs.tsx + alle Screens)*
- [x] **HomeScreen-Queries parallelisiert** ✅ – die unabhängigen Abfragen laufen jetzt gebündelt per `Promise.all` (statt nacheinander) → deutlich schnellerer Aufbau. *(HomeScreen.tsx)*

## 🟡 Qualität & Wartbarkeit (mittelfristig)

### Daten/DB
- [x] **Indizes ergänzt** ✅ – Migration 015: `food_logs(food_id)`, `progress_entries(user_id, entry_date)`, `foods(category)`. *(recipe_items entfällt – Rezepte raus)*
- [x] **FK `ON DELETE` explizit machen** ✅ (Migration 016) (`food_logs.food_id`, `recipe_items.food_id`, `set_logs.exercise_id`, `workout_plan_exercises.exercise_id` → `on delete restrict`); `foods.user_id` beim Nutzer-Löschen: cascade statt verwaisen. *(db/005, 010, schema.sql, 011)*
- [~] **`foods.name` UNIQUE überdenken** (bewusst aufgeschoben – Seeds 005/006 nutzen `on conflict (name)`, müsste zuerst angepasst werden; Hinweis in db/016) – global eindeutig kollidiert mit nutzereigenen Einträgen. → partielle Indizes (global `where user_id is null`, eigen `(user_id, name)`). *(db/005/006/011)*
- [x] **`exercises.name` UNIQUE** ✅ (Migration 016 – Unique-Index, übersprungen falls Altdaten kollidieren) (Seed race-/wiederholungssicher). *(db/schema.sql, 003, 008)*
- [x] **„Genau ein aktives Ziel" / 1 Gewicht pro Tag** ✅ (Migration 016: partielle Unique-Indizes `goals_one_active_per_user` + `progress_one_per_day`; doppelte aktive Ziele werden vorher bereinigt). *(db/016)*

### Code
- [x] **Fehlerbehandlung bei Supabase-Writes** ✅ ERLEDIGT (Schreibvorgänge prüfen jetzt `error` → freundlicher Hinweis/Alert via zentralem `errorMessage`, bei optimistischen Updates zusätzlich Resync mit der DB) – früher: viele `insert/update/delete` ignorieren `error` (stille Fehlschläge, optimistischer State läuft mit DB auseinander). *(weight.ts, HomeScreen, WaterScreen, PlanScreen, TrainingScreen, FoodTrackerScreen)*
- [~] **Duplikation zentralisieren** (teilweise ✅) – fertig: Anzeige-/Erlaubt-Konstanten (`DIFF/EQUIP_LABELS`, `ALLOWED_DIFF/EQUIP`) → `lib/training.ts`; Datums-Helfer → `lib/date.ts`; `grp/unwrap` → `lib/format.ts`; **Wasser-Konstanten (`WATER_GOAL`/`GLASS`) → neue `lib/water.ts`** ✅; **`KEY_TO_SLUGS` entfällt** (durch seitenabhängiges `keyForSlug` in BodyMuscleMap ersetzt) ✅. Offen (minor): restliche Datums-Helfer (mondayOf/dStr). *(diverse)*
- [ ] **Nicht-atomare Delete→Insert** (Plan/Rezept/Ziel) → RPC-Transaktion oder „erst neu anlegen, dann altes deaktivieren". *(NutritionScreen, PlanScreen, RecipesScreen)*
- [x] **Memoisierung** ✅ – ThemeContext-`value` per `useMemo` (verhindert App-weite Re-Renders); `makeStyles` per `useMemo` in den eingabe-intensiven Screens (FoodTracker, ExerciseDetail, Progress). *(Loader-`useCallback` in den übrigen Screens optional – greift kaum, da Bereiche jetzt gemountet bleiben.)*
- [~] **Kleinkorrekturen** – `parseWeight` nutzt `Number.isNaN` ✅; `recipeFor`/`swapMeal` & Rezept-0g-Validierung **hinfällig** (Rezepte/Ernährungsplan entfernt); Barcode-Konflikt per Barcode bleibt minor offen. *(barcodeFood.ts)*
- [x] **Tote Styles entfernen** ✅ (FoodTracker: 12 Redesign-Reste, ProgressScreen: 3 Delta-Styles, ExerciseDetail: 1× ungenutztes `instr`). *(diverse)*

### UX / Barrierefreiheit
- [~] **Ernährungsplan ins Tagebuch übernehmen** – ✅ **hinfällig**: Ernährungsplan & `NutritionScreen` wurden auf Wunsch entfernt (Essen = Tracker + Wasser). *(—)*
- [x] **`accessibilityLabel`/`Role` ergänzt** ✅ – Icon-Buttons (✕ Tagebuch/Wasser/Gewicht, 🗑 Lebensmittel, ↩ Wasser-Undo, ＋ Mahlzeit, Satz löschen, Erfolge) + Tab-Leiste (`accessibilityRole="tab"` + selected) beschriftet. *(Gauge/Body-Map ohne Label belassen – stehen neben lesbarem Text.)*
- [x] **`hitSlop` ergänzt** ✅ – an den kleinen Lösch-/Undo-Buttons (Progress/Water/FoodTracker). *(Tab-Höhe iOS via paddingBottom ok.)*
- [x] **Fehlermeldungen-Farbe** ✅ – SettingsScreen nutzt jetzt ein `msgErr`-Flag (rot bei Fehler, grün bei Erfolg). *(Rezepte entfernt.)* *(SettingsScreen)*
- [x] **„Onboarding erneut" warnen** ✅ – Bestätigungsdialog + altes aktives Ziel wird deaktiviert (keine doppelten aktiven Ziele). *(SettingsScreen)*
- [x] **Feldspezifische Validierungsmeldungen** ✅ – klare Meldungen je Feld in ProfileScreen **und** Onboarding (statt „alle Felder gültig"). *(OnboardingScreen, ProfileScreen)*
- [x] **Achievements antippbar** ✅ – Tippen zeigt Bedingung/Beschreibung + ob freigeschaltet (Alert). *(HomeScreen)*
- [x] **Satz nachträglich löschen** ✅ – ✕ pro Satz-Zeile beim Mitschreiben (löscht aus set_logs). *(ExerciseDetail.tsx)*
- [x] **OpenFoodFacts-Timeout** ✅ – `AbortController` mit 8 s, bricht ab statt ewig zu hängen (danach klare „nicht gefunden"-Meldung). *(openFoodFacts.ts)*

### Performance (weitere)
- [~] **foods-Liste app-weit cachen** – `RecipesScreen` entfernt → `foods` wird faktisch nur noch ~1× geladen (FoodTracker); app-weiter Cache jetzt geringer Nutzen. *(FoodTrackerScreen)*
- [ ] **Progress/ExerciseProgress server-aggregieren** (laden alle `set_logs`). *(ProgressScreen, ExerciseProgress)*
- [x] **GIF-Caching** ✅ – `ExerciseGif` nutzt jetzt `expo-image` mit `cachePolicy="memory-disk"` (GIFs werden zuverlässig gecacht statt erneut von der Rate-limitierten API geladen). *(ExerciseGif.tsx)*
- [x] **PlanScreen `addExercise` optimistisch** ✅ – fügt die neue Übung lokal ein (lädt nur die eine Übung nach) statt den ganzen Plan neu zu laden. *(muscles-Cache: minor, offen)*

## 🔵 Kleinigkeiten / Doku
- [x] **Erinnerungs-Handler** ✅ – auf `shouldShowBanner`/`shouldShowList` umgestellt, `as any` entfernt. *(lib/reminders.ts)*
- [ ] **`exercise_muscles`** (Sekundärmuskeln) befüllen & anzeigen ODER aus Schema/Konzept entfernen (aktuell totes Schema). *(db/schema.sql)*
- [x] **README/HANDOVER aktualisiert** ✅ – Features, Projektstruktur, Migrationsliste (002–015) und Stand aktualisiert; entfernte Features (Ernährungsplan/Rezepte) vermerkt. *(README.md, HANDOVER.md)*
- [x] **008-Kommentar klargestellt** ✅ – Hinweis ergänzt: GIFs kommen client-seitig via `lib/exerciseMedia.ts` über den Namen, keine GIF-Spalte. *(db/008)*

---

## Was bereits gut ist 👍
- Saubere Trennung von Logik (`lib/`) und UI; konsequentes Theme-System (Hell/Dunkel).
- RLS auf **jeder** Nutzer-Tabelle (`auth.uid() = user_id`), Referenzdaten read-only, FKs auf `auth.users` durchgängig `on delete cascade`.
- Alle Migrationen idempotent; `tsc` fehlerfrei.
- Gute Leerzustände, Lade-Spinner, deutsche Fehlerübersetzung beim Login, sauberes 5-Schritt-Onboarding mit Validierung.
- Korrekte Nährwert-/Gamification-/Wochentag-Logik; sauberer GIF-Fallback (kein Crash ohne Key); vorbildliches Auth-Deadlock-Handling.
