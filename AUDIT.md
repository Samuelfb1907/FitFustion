# FitFusion – Gesamt-Audit & To-Do-Liste

> Erstellt durch einen Multi-Agent-Audit (26 Agenten: 1 Karte, 6 Dimensionen, kritische/hohe Funde gegen den echten Code verifiziert).
> Schweregrade = **verifizierte** Einstufung (nach Gegenprüfung). Status: Stand des Audits, noch nichts davon umgesetzt.

## Gesamtbild

Der **App-Code ist erstaunlich solide**: `tsc` ist fehlerfrei, alle 14 Screens sind end-to-end verdrahtet, die Kern-Logik (Kalorien nach Mifflin-St-Jeor, Gamification, Wochentage) ist korrekt, RLS ist auf jeder Nutzer-Tabelle aktiv, alle Migrationen sind idempotent, und Fehler werden meist abgefangen (selten harte Crashes). Die wichtigsten Baustellen liegen in **Setup-Doku, Datenschutz/DSGVO, Robustheit (Offline), Bestätigungen bei Löschungen, Barrierefreiheit und Performance bei langen Listen / Tab-Remounts**.

| Bereich | Ampel | Kurzfazit |
|---|---|---|
| Funktionalität & Konzept | 🟢 | Alles real implementiert; Lücke: Allergie-System unvollständig |
| Code & Architektur | 🟡 | Sauber strukturiert; Zeitzonen-Bug, Race Condition, viel Duplikation |
| User-Experience | 🟡 | Konsistentes Design; fehlende Bestätigungen, kein Offline-Konzept, 0 A11y |
| Cybersecurity & Datenschutz | 🟠 | Kein Konto-Löschen (DSGVO), API-Key im Client, E-Mail unbestätigt |
| Datenmodell & Migrationen | 🟡 | Solide; foods-Lese-Policy zu offen, fehlende Indizes |
| Performance & Stabilität | 🟡 | Lange Listen ohne Virtualisierung, Tab-Remount lädt alles neu |

---

## 🔴 Sofort (vor weiterem Ausbau – klein & wirkungsvoll)

- [ ] **Setup-Doku korrigieren** – README Schritt 3 + HANDOVER listen nur Migrationen bis 007/009. Der Code braucht **008–013** zwingend. Wer dem Setup folgt, bekommt eine teils leere/kaputte App (Tracker, Wasser, Rezepte, Barcode, Wochenplan). → Migrationsliste auf `schema.sql → 005 → 006 → 007 → 009 → 010 → 011 → 012 → 013` ergänzen (008 = optionale Übungs-Seeds). *(README.md, HANDOVER.md)*
- [ ] **foods-Lese-Policy einschränken** – `foods_read_all = using(true)` macht **eigene/gescannte Lebensmittel inkl. Besitzer-UUID für ALLE Nutzer sichtbar**. → `using (user_id is null or auth.uid() = user_id)` (+ `to authenticated`). Kleine SQL-Migration. *(db/011_barcode.sql, FoodTrackerScreen.tsx)*
- [x] **Allergie-Versprechen gelöst** ✅ – Allergene werden jetzt **automatisch aus den Zutaten** abgeleitet (`lib/allergens.ts`, Zutat→Allergen-Map) und mit den manuellen Tags vereinigt; `safeMealsFor` filtert darüber. Damit greifen auch zutatenbasierte Allergene wie Banane/Apfel/Weizen/Mais/Soja/Nüsse/Fisch/Kokos/Sesam/Zitrus/Nachtschatten. UI-Text ehrlich gemacht („nach Möglichkeit ausgeschlossen – bitte Zutaten selbst prüfen") + Hinweis, wenn eine Mahlzeit wegen Allergien wegfällt. *(Rein zutatenferne Intoleranzen wie Histamin/Fruktose/Sulfite bleiben naturgemäß ungefiltert.)* *(lib/allergens.ts, lib/meals.ts, NutritionScreen.tsx)*

## 🟠 Wichtig (vor einer Veröffentlichung)

### Sicherheit & Datenschutz
- [ ] **DSGVO: Konto- & Datenlöschung + Export** – Gesundheitsdaten (Art. 9) ohne jeden Self-Service für Art. 17/20. → Supabase Edge Function (service_role) `auth.admin.deleteUser` (Tabellen haben bereits `on delete cascade`) + „Konto & Daten löschen"-Button mit Bestätigung; optional JSON-Export. *(SettingsScreen.tsx)*
- [ ] **ExerciseDB/RapidAPI-Key aus dem Client nehmen** – `EXPO_PUBLIC_EXERCISEDB_KEY` wird ins Bundle gebacken → der **bezahlte** Key ist aus jeder App auslesbar. → GIF-Abruf über Proxy/Edge-Function (Key serverseitig) **und Key bei RapidAPI rotieren**; RapidAPI-Spend-Limit setzen. *(components/ExerciseGif.tsx, .env)*
- [ ] **E-Mail-Bestätigung aktivieren** – aktuell aus → Registrierung mit fremden Adressen möglich, Reset untergraben. → In Supabase-Auth „Confirm email" an; Mindest-Passwortlänge erhöhen. *(Supabase-Einstellung, AuthScreen.tsx)*

### Robustheit & UX
- [ ] **Offline-/Fehler-Konzept** – Ladefunktionen ohne `try/catch/finally` → bei Netzfehler **endloser Spinner** ohne Meldung/Retry (Home, Tracker, Progress, Water, Training, Plan). → in `try/finally` kapseln (`setLoading(false)` im finally), Fehlerzustand + „Erneut versuchen", **Pull-to-Refresh** (RefreshControl). *(HomeScreen, FoodTrackerScreen, ProgressScreen, WaterScreen, TrainingScreen, PlanScreen)*
- [ ] **Destruktive Aktionen bestätigen** – „Neuen Plan erstellen" löscht Wochenplan + macht den angepassten Plan unerreichbar **ohne Rückfrage**; Rezept-/Übungs-/Gewichts-/Tagebuch-Löschen ohne Bestätigung/Undo. → `Alert.alert`-Bestätigung (Muster `confirmDeleteFood` existiert schon) bzw. Undo. *(PlanScreen, RecipesScreen, ProgressScreen, FoodTrackerScreen)*
- [ ] **App-Anzeigename „FitFusion"** – `app.json` `name`/`slug` sind „app" → Home-Screen/App-Switcher zeigen „app". *(app.json)*
- [ ] **Dark Mode durchziehen** – `userInterfaceStyle: "light"` → native Dialoge/Tastatur bleiben hell trotz Dunkelmodus. → auf `"automatic"`, `keyboardAppearance` ans Theme koppeln. *(app.json)*
- [ ] **„Passwort vergessen?" im Login** – Reset ist nur nach Login erreichbar; wer ausgesperrt ist, kommt nicht rein. *(AuthScreen.tsx)*
- [ ] **Allergien im Profil editierbar** – aktuell nur im Onboarding setzbar, steuern aber den ganzen Ernährungsplan. → MultiChoice in ProfileScreen (ALLERGIES-Liste teilen). *(ProfileScreen.tsx)*

### Korrektheit
- [ ] **Zeitzonen-Bug (Streak/Heute/Woche)** – UTC-`performed_at` wird per `slice(0,10)` mit lokal gebildeten Datumsstrings verglichen → Trainings kurz nach Mitternacht zählen für den Vortag. → lokale Datumsableitung (`new Date(iso)` + getFullYear/Month/Date) zentral. *(HomeScreen, gamification.ts, ProgressScreen, ExerciseProgress)*
- [ ] **Profil-Speichern überschreibt Geburtsdatum auf 01.01.** – Alter→`${jahr}-01-01` verändert das Kalorienziel beim bloßen Gewicht-Update. → Monat/Tag erhalten bzw. nur bei Änderung umrechnen. *(ProfileScreen.tsx, OnboardingScreen.tsx)*
- [ ] **Doppelter Satz möglich (Race Condition)** – `set_index = sets.length+1` aus State + nur `saving`-Flag → schneller Doppeltipp erzeugt zwei „Satz 1". → `useRef`-Lock + `unique(session_id, exercise_id, set_index)`. *(ExerciseDetail.tsx, db/schema.sql)*

### Performance
- [x] **Lange Listen virtualisieren** ✅ – Lebensmittel-Auswahl auf `FlatList` umgestellt (nur sichtbare Zeilen, `initialNumToRender`/`windowSize`/`removeClippedSubviews`), `filteredFoods` + `makeStyles` per `useMemo`. Behebt die ~1s-Verzögerung beim „+". *(FoodTrackerScreen.tsx)*
- [x] **Tab-Remount entschärft** ✅ – Bereiche bleiben gemountet (Sichtbarkeits-Umschaltung, faul nachgeladen) → Wechsel ist sofort. Per `focusTick` (lib/useFocusTick) springt der Reiter beim Antippen auf seine Startansicht zurück und lädt die Daten **leise** neu (kein Spinner). *(MainTabs.tsx + alle Screens)*
- [ ] **HomeScreen-Queries reduzieren** – ~12 sequentielle Queries inkl. 2 Voll-Scans + 3 counts. → `Promise.all` parallel, Aggregation server-seitig (RPC/View) oder Zeitfenster `.gte()`. *(HomeScreen.tsx)*

## 🟡 Qualität & Wartbarkeit (mittelfristig)

### Daten/DB
- [ ] **Indizes ergänzen**: `food_logs(food_id)`, `recipe_items(food_id)`, `progress_entries(user_id, entry_date)`, optional `foods(category)`. *(Folge-Migration)*
- [ ] **FK `ON DELETE` explizit machen** (`food_logs.food_id`, `recipe_items.food_id`, `set_logs.exercise_id`, `workout_plan_exercises.exercise_id` → `on delete restrict`); `foods.user_id` beim Nutzer-Löschen: cascade statt verwaisen. *(db/005, 010, schema.sql, 011)*
- [ ] **`foods.name` UNIQUE überdenken** – global eindeutig kollidiert mit nutzereigenen Einträgen. → partielle Indizes (global `where user_id is null`, eigen `(user_id, name)`). *(db/005/006/011)*
- [ ] **`exercises.name` UNIQUE + `on conflict`** (Seed race-/wiederholungssicher). *(db/schema.sql, 003, 008)*
- [ ] **„Genau ein aktives Ziel" / 1 Gewicht pro Tag** absichern (partielles UNIQUE bzw. Upsert). *(db/schema.sql)*

### Code
- [ ] **Fehlerbehandlung bei Supabase-Writes** – viele `insert/update/delete` ignorieren `error` (stille Fehlschläge, optimistischer State läuft mit DB auseinander). *(weight.ts, HomeScreen, WaterScreen, PlanScreen, TrainingScreen, FoodTrackerScreen)*
- [ ] **Duplikation zentralisieren** – Datums-Helfer (8 Dateien!), `KEY_TO_SLUGS`, `ALLOWED_DIFF/EQUIP`, `DIFF/EQUIP_LABELS`, `unwrap/ddmm/grp`, Wasser-Logik → `lib/date.ts`, `lib/muscles.ts`, `lib/training.ts`, `lib/water.ts`. *(diverse)*
- [ ] **Nicht-atomare Delete→Insert** (Plan/Rezept/Ziel) → RPC-Transaktion oder „erst neu anlegen, dann altes deaktivieren". *(NutritionScreen, PlanScreen, RecipesScreen)*
- [ ] **Loader memoisieren** (`useCallback`) statt `useEffect(()=>{init()},[userId])`; `makeStyles` per `useMemo`; ThemeContext-`value` per `useMemo`. *(mehrere)*
- [ ] **`recipeFor`/`swapMeal` über stabilen Key statt Anzeigename**; Rezept-0g-Items validieren; Barcode-Konflikt zusätzlich per Barcode auflösen; `parseWeight` `Number.isNaN`. *(meals.ts, RecipesScreen, barcodeFood.ts, weight.ts)*
- [ ] **Tote Styles entfernen** (FoodTrackerScreen, ProgressScreen, ExerciseDetail). *(diverse)*

### UX / Barrierefreiheit
- [ ] **Ernährungsplan ins Tagebuch übernehmen** – Plan-Gerichte haben keinen „Ins Tagebuch"-Button (Rezepte schon). *(NutritionScreen.tsx)*
- [ ] **`accessibilityLabel`/`Role` ergänzen** – 0 im ganzen Projekt; Icon-Buttons (✕, 🗑, ↩, ＋, Stepper) für Screenreader stumm; Gauge/Balken ohne Wert. *(alle Screens, MainTabs, CalorieGauge)*
- [ ] **Touch-Ziele ≥44px + `hitSlop`** (Tab-Leiste, Löschen in Progress/Water/Recipes). *(MainTabs u.a.)*
- [ ] **Fehlermeldungen-Farbe** – in Settings/Rezepte erscheinen Fehler **grün** (`styles.msg = success`). → isError-Flag wie in ProfileScreen. *(SettingsScreen, RecipesScreen)*
- [ ] **„Onboarding erneut" warnen** + altes Ziel deaktivieren (sonst mehrere aktive Ziele). *(SettingsScreen, OnboardingScreen)*
- [ ] **Feldspezifische Validierungsmeldungen** (Onboarding/Profil statt „alle Felder gültig"). *(OnboardingScreen, ProfileScreen)*
- [ ] **Gesperrte Achievements**: Bedingung/Fortschritt anzeigen (description wird nicht gerendert). *(HomeScreen, gamification.ts)*
- [ ] **Satz nachträglich bearbeiten/löschen** beim Mitschreiben (Tippfehler verfälscht PRs dauerhaft). *(ExerciseDetail.tsx)*
- [ ] **OpenFoodFacts-Timeout + Abbrechen** beim Barcode-Scan. *(openFoodFacts.ts, FoodTrackerScreen)*

### Performance (weitere)
- [ ] **foods-Liste app-weit cachen** (3× unabhängig geladen). *(FoodTrackerScreen, RecipesScreen, EssenScreen)*
- [ ] **Progress/ExerciseProgress server-aggregieren** (laden alle `set_logs`). *(ProgressScreen, ExerciseProgress)*
- [ ] **GIF-Caching** via `expo-image` (CachePolicy + `cacheKey=exerciseId`). *(ExerciseGif.tsx)*
- [ ] **PlanScreen**: `muscles` einmal cachen; `addExercise` optimistisch statt voller `loadPlan`. *(PlanScreen.tsx)*

## 🔵 Kleinigkeiten / Doku
- [ ] **Erinnerungs-Handler** auf aktuelles Schema (`shouldShowBanner`/`shouldShowList`) umstellen, `as any` entfernen. *(lib/reminders.ts)*
- [ ] **`exercise_muscles`** (Sekundärmuskeln) befüllen & anzeigen ODER aus Schema/Konzept entfernen (aktuell totes Schema). *(db/schema.sql)*
- [ ] **README/HANDOVER aktualisieren** – umgesetzte Features (Rezepte, Tagesziele/Challenges, Barcode, Wasser, Wochenkalender, Pausen-Timer) stehen z. T. noch unter „geplant"; Projektstruktur/Migrationsliste veraltet. *(README.md, HANDOVER.md)*
- [ ] **008-Kommentar klarstellen** („GIFs via lib/exerciseMedia.ts über den Namen, keine GIF-Spalte"). *(db/008)*

---

## Was bereits gut ist 👍
- Saubere Trennung von Logik (`lib/`) und UI; konsequentes Theme-System (Hell/Dunkel).
- RLS auf **jeder** Nutzer-Tabelle (`auth.uid() = user_id`), Referenzdaten read-only, FKs auf `auth.users` durchgängig `on delete cascade`.
- Alle Migrationen idempotent; `tsc` fehlerfrei.
- Gute Leerzustände, Lade-Spinner, deutsche Fehlerübersetzung beim Login, sauberes 5-Schritt-Onboarding mit Validierung.
- Korrekte Nährwert-/Gamification-/Wochentag-Logik; sauberer GIF-Fallback (kein Crash ohne Key); vorbildliches Auth-Deadlock-Handling.
