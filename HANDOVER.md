# HANDOVER – FitAvo (Projekt-Übergabe für Claude)

> **Zweck:** Kompletter Projektstand, damit eine **neue Claude-Session ohne Vorwissen** sofort
> weiterarbeiten kann. Im neuen Chat einfügen oder darauf verweisen.
>
> *Stand: 5-Tab-App (Expo SDK 54 + Supabase). Training-Hub (klickbarer Körper → Übungen mit
> animierten GIFs → Detail/Logging + Pausen-Timer), Trainingsplan mit Wochenkalender & Tag-Bearbeiten,
> Essen-Hub (Kalorien-Tracker mit Mahlzeiten/Schnellzugriff/Barcode/eigene Lebensmittel + Wasser-Tracker),
> Fortschritt (inkl. Übungs-Verlauf), Tagesziele & Challenges, Gamification, Dark Mode, Erinnerungen
> (startklar), **DSGVO (Export/Konto löschen) + Haftungsausschluss**. **Ernährungsplan & Rezepte wurden
> auf Wunsch entfernt** (Essen = Tracker + Wasser). Läuft im Browser UND auf dem iPhone (Expo Go).
> Offene To-dos: siehe `AUDIT.md`.*

---

## 0. Aktueller Stand & Wiedereinstieg

### 🟣 LETZTER STAND (Juni 2026) – Design-Refresh, Bestenliste, Motivation, Android-Beta
- **Komplettes modernes Design:** neues **Indigo/Violett-Farbsystem** (`contexts/ThemeContext.tsx`, hell+dunkel) + app-weiter **Bento-Grid-Stil** (stark abgerundete Kacheln, weiche Schatten). Umgesetzt auf **allen** Screens: Home (echtes Bento-Dashboard mit Mini-KPI-Kacheln), Wasser, Tracker, Fortschritt, Training, Plan, Einstellungen, Onboarding, Profil. **Login** neu mit Punkteraster-Hintergrund (`react-native-svg`). Geteilter Karten-Schatten in **`lib/ui.ts`** (`CARD_SHADOW`). Tab-Leiste mit Indikator-Strich.
- **Bestenliste / Leaderboard (opt-in, datenschutzfreundlich):** `lib/leaderboard.ts` + `screens/LeaderboardScreen.tsx`, eingebunden im **Fortschritt-Reiter** (Segmented „Meine Werte | 🏆 Bestenliste"). Rangliste nach **aktiven Ziel-Tagen** (= Tag mit Essens-Eintrag ODER Training), umschaltbar **Woche/Monat**. Teilnahme = eigene Zeile in `leaderboard_entries`; Aussteigen löscht sie. **➡️ Migration 017 (`db/017_leaderboard.sql`) MUSS in Supabase ausgeführt sein**, sonst Fehler in der Liste.
- **Tägliche Motivation:** `lib/quotes.ts` (110+ Sprüche) + Erweiterung in `lib/reminders.ts` (rotierende Tages-Benachrichtigung, ~45 Tage im Voraus geplant, Schalter „💬 Tägliche Motivation" + Uhrzeit in Einstellungen). **Pushes erscheinen nur im echten Build, nicht in Expo Go.**
- **Closed Beta / Android-Build (EAS):** `app/eas.json` (Profil **preview = APK**), `app/app.json` mit `android.package`/`ios.bundleIdentifier` = **`com.samuelfb1907.fitavo`**, `extra.eas.projectId` = **`75146814-4f6b-45f6-8928-dbb2004f15c8`**, `owner` = **`samuelfb1907`**. Anleitung in **`ANDROID_BUILD.md`**. Erster APK-Build lief erfolgreich. EAS-**Env-Vars** (EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY) sind im **Preview-Environment** auf expo.dev hinterlegt.
- **Offener Bug + Fix-Versuch:** In der **APK** ließen sich die **Muskeln in der Körpergrafik nicht antippen** (in Expo Go schon → Release-/SVG-Touch-Thema). Fix: (1) **Muskel-Buttons** unter der Grafik sind jetzt die zuverlässige Haupt-Auswahl; (2) **`newArchEnabled: false`** in `app.json` (Versuch, den Body-Tap im Release zu reparieren). **➡️ OFFEN: neue APK bauen & testen, ob der Body-Tap jetzt geht.** Wenn ja → New Arch aus lassen. Wenn nein → `newArchEnabled` wieder entfernen (Buttons genügen).

### ➡️ Sofort offene Schritte (für die nächste Sitzung)
1. **APK neu bauen & Body-Tap testen:** im Terminal `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path` → `cd C:\Users\Samuel\fitness-app\app` → `npx.cmd eas-cli build -p android --profile preview`. *(`npx.cmd` wegen PowerShell-ExecutionPolicy; ExecutionPolicy steht auf RemoteSigned.)*
2. **Migration 017** in Supabase SQL Editor ausführen (Bestenliste) – falls noch nicht.
3. Evtl. läuft noch ein **Expo-Dev-Server im Hintergrund** (kann gestoppt werden).
4. Längerfristig (nur Nutzer): Rechtstexte-Platzhalter (`lib/legal.ts`), ExerciseDB-Key absichern, iOS/TestFlight (Apple Developer Account).

### Build/Beta-Spickzettel
- **Migrationen jetzt 002–017** (017 = Bestenliste).
- EAS: `npx.cmd eas-cli build -p android --profile preview` → Link/QR zur APK (Free-Tier-Queue kann lange dauern → „Notify me", Randzeiten schneller). Konto `samuelfb1907`.
- APK ist eigenständig: **PC muss NICHT laufen**; Backend = Supabase (Cloud). Benachrichtigungen funktionieren im echten Build.

- **Zuletzt gebaut (neueste zuerst):**
  - **Audit-Abbau in Batches** (`AUDIT.md`): foods-Leseregel + Indizes (**Migration 015**), Zeitzonen-Fix
    (`lib/date.ts` `localDateStr`), Bestätigungs-Dialoge, Barrierefreiheit (accessibilityLabel), Performance
    (**Tabs bleiben gemountet** via `lib/useFocusTick` → sofortiger Wechsel; **FlatList** für Lebensmittel;
    HomeScreen `Promise.all`; **expo-image**-Disk-Cache für GIFs), Geburtsdatum-Fix, Race-Lock beim Satz-Speichern u. v. m.
  - **DSGVO** (`lib/gdpr.ts`): Einstellungen → **Datenschutz** = Datenexport (JSON teilen), „Konto & alle Daten
    löschen", Datenschutzerklärung-Vorlage. **Migration 014** (`profiles_delete_own`). Optionale Edge Function
    `supabase/functions/delete-account` (echtes Auth-Konto-Löschen) – siehe `SUPABASE_FUNCTIONS.md`.
  - **Haftungsausschluss** (`lib/legal.ts`, 15 Abschnitte) + Pflicht-Zustimmung bei der Registrierung; `RECHTLICHES.md`.
  - **Ernährungsplan & Rezepte auf Wunsch ENTFERNT** (Essen = Tracker + Wasser); `NutritionScreen`/`RecipesScreen`/`lib/allergens.ts` gelöscht.
- **⚠️ OFFENE DB-SCHRITTE (idempotent, im SQL Editor, Reihenfolge s. Abschnitt 6):** Migrationen **008–017**
  müssen ausgeführt sein – sonst fehlen Übungen / Wasser / Barcode-Spalten / Mahlzeiten-Typ / Wochenplan /
  DSGVO-Lösch-Policy / Indizes. (DB-Tabellen `nutrition_plans`,`meals`,`recipes`,`recipe_items` bleiben ungenutzt bestehen.)
- **⚠️ API-Keys in `app/.env`** (gitignored): `EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY`, `EXPO_PUBLIC_EXERCISEDB_KEY`
  (bezahlt, für GIFs – sollte vor Release hinter einen Proxy/Edge-Function).
- **Handy:** in `app/` → `npx expo start` (nach `.env`/Modul/`app.json`-Wechsel `-c`), QR scannen. SDK bleibt **54**.
- **Browser/Build-Check:** `npx expo start --web` · `npx tsc --noEmit`.
- **Offene To-dos:** siehe **`AUDIT.md`** – u. a. ExerciseDB-Key serverseitig, **E-Mail-Bestätigung aktivieren**
  (Supabase), Impressum + Datenschutz-Platzhalter ausfüllen, Dev-Build für echte Erinnerungen, anwaltliche Prüfung.

---

## 1./2. Projekt & Arbeitsweise
- **FitAvo** = mobile Fitness-/Ernährungs-App. Produktvision: `FitAvo-Masterfile.docx`.
- Nutzer ist **Anfänger**; Modus **„Claude richtet ein, erklärt jeden Schritt"**, **Sprache Deutsch**.
  Ablauf: bauen → `npx tsc --noEmit` → testen lassen → committen. **Hoher Qualitätsanspruch** – lieber
  ehrlich Grenzen nennen (z. B. selbstgemalte Animationen wurden abgelehnt → ExerciseDB-GIFs).

## 3. Umgebung (Windows) – Stolpersteine
- **PowerShell 5.1**, Arbeitsverzeichnis `C:\Users\Samuel\fitness-app`.
- **Node v24 portabel** unter `C:\Users\Samuel\tools\node` (nicht im PATH): vorher
  `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`.
- **PS 5.1 zeigt UTF-8 als ANSI falsch** (Umlaute „Ã¤") → zum Prüfen **Read-Tool** / `Get-Content -Encoding UTF8`.
- **git commit:** mehrzeilig/Sonderzeichen scheitern am Quoting → `git commit -F <tempdatei>` ODER
  zwei einzeilige `-m` (Subject + `-m "Co-Authored-By: ..."`). `$env:GIT_TERMINAL_PROMPT='0'`.
- DB-Änderungen als SQL liefern; **Nutzer führt sie im Supabase SQL Editor aus** (per `Set-Clipboard`).
- **Neues Modul / `.env` / `app.json` geändert → Metro neu starten** (`npx expo start -c`).

## 4. Tech-Stack
| Bereich | Wahl |
|---|---|
| Frontend | **Expo SDK 54**, React Native 0.81.5, React 19.1.0, TypeScript 5.9 |
| Backend/DB | Supabase (PostgreSQL, Auth, RLS) |
| Libs | supabase-js, async-storage, url-polyfill, **react-native-svg**, **react-native-body-highlighter**, **expo-notifications** |
| Repo | GitHub `Samuelfb1907/FitFustion`, Branch `main` |
- **SDK 54 FIX** (Expo Go des Nutzers). Versionen via `npx expo install`/`--fix`.

## 5. Supabase
- Ref `ugofjmdwjcrjvakilmsu` · URL `https://ugofjmdwjcrjvakilmsu.supabase.co` · Dashboard `https://supabase.com/dashboard/project/ugofjmdwjcrjvakilmsu`
- Keys in `app/.env` (gitignored). E-Mail-Bestätigung aus. DB-Passwort/service_role NIE teilen.

## 6. Datenbank + Migrationen (im SQL Editor, in Reihenfolge)
`schema.sql` → `002_allergies` → `003_more_exercises` → `004_more_exercises` → `005_food_tracking`
→ `006_foods_500plus` → `007_session_end` (`workout_sessions.ended_at`) → `008_more_exercises_gifs`
(Übungs-Seeds, optional) → `009_water` (`water_logs`) → `010_recipes` (recipes/recipe_items – ungenutzt)
→ `011_barcode` (`foods.barcode`+`user_id`) → `012_meal_types` (`food_logs.meal_type`)
→ `013_plan_schedule` (Wochenplan) → `014_gdpr` (`profiles_delete_own`) → `015_privacy_indexes`
(foods-Leseregel `foods_read_global_or_own` + Indizes) → `016_integrity` (FK-Löschverhalten explizit + `goals`/`progress`/`exercises`-Integritäts-Indizes) → `017_leaderboard` (Bestenliste `leaderboard_entries`, opt-in, RLS read-all/write-own). Alle idempotent. RLS überall (`auth.uid()=user_id`).
- Muskel-Keys: chest, back, shoulders, biceps, triceps, abs, legs, calves, glutes.
- `water_logs`: id, user_id, log_date, amount_ml, created_at (RLS own).

### 6b. Übungs-GIFs (ExerciseDB) – WICHTIG
- ExerciseDB via **RapidAPI**, Host `exercisedb.p.rapidapi.com`, Key `EXPO_PUBLIC_EXERCISEDB_KEY` in `.env` (**bezahlter Plan**).
- **Kein `gifUrl`-Feld!** GIF nur über Bild-Endpunkt:
  `GET https://exercisedb.p.rapidapi.com/image?exerciseId={ID}&resolution=360` mit Headern
  `X-RapidAPI-Key` + `X-RapidAPI-Host`. **GET (nicht HEAD!)**, Header zwingend.
- `app/lib/exerciseMedia.ts`: Map *deutscher Name → ExerciseDB-ID* (auto-generiert) + `exerciseGifId(name)`.
- `components/ExerciseGif.tsx` lädt das GIF (`<Image source={{uri, headers}}>`, RN cached → ~1 Request/Übung);
  bei Fehler → `onFail` → Fallback `ExerciseFigure` (statische anatomische Muskelgrafik).
- **Neue Übungen + GIFs hinzufügen:** Generator-Skripte liegen in `%TEMP%` (nicht im Repo): `gen-final.js`
  erzeugt `exerciseMedia.ts` + `008_*.sql`; `%TEMP%\exercisedb-list.json` = ExerciseDB-Liste
  (`/exercises?limit=1500` + Key). In `gen-final.js` die `ADDED`-Liste ergänzen (Name + keywords ODER feste
  `id` + muscle/equipment/difficulty/desc/instr) → `node gen-final.js`. SQL-Spaltenreihenfolge =
  (name, difficulty, equipment, muscle_key, …).

### 6c. Erinnerungen (expo-notifications)
- `lib/reminders.ts`: `ReminderPrefs` (enabled/water/training/trainingHour) in AsyncStorage `fitavo.reminders`;
  `applyReminders()` plant tägliche lokale Notifications (Trigger `{type:'daily',hour,minute}`).
- `app.json` hat `"plugins": ["expo-notifications"]`.
- **Expo Go feuert nicht** (v. a. iOS) → erst im **Dev-Build**. iOS-Dev-Build: Apple-Entwickler-Konto (99 $/Jahr) + EAS.

## 7. App-Struktur (aktuell)
```
app/
  App.tsx  – Routing (loading -> Auth / Onboarding / MainTabs), Theme+Auth Provider
  contexts/AuthContext.tsx  – session + profile {id, first_name, gender, experience_level, training_environment}
                              (Deadlock-Hinweis: im onAuthStateChange NIE await auf DB!)
  contexts/ThemeContext.tsx – Dark/Light (useColors/useTheme); Tokens inkl. accent/hero/muscle
  components/ BodyMuscleMap (klickbarer Koerper, gender m/w) · ExerciseGif · ExerciseFigure ·
              ExerciseDetail (GIF/Fallback + Schritte + Tipps + Mitschreiben + "Training beenden") ·
              CalorieGauge · Charts · Segmented
  lib/ supabase · nutrition · meals · gamification · exerciseMedia (Name->GIF-ID) · goals (Tagesziele/Challenges) · reminders
  screens/ Auth · Onboarding(5 Schritte) · MainTabs(5 Reiter: Start|Training|Essen|Fortschritt|Einstellungen)
           HomeScreen – Hero, "Training laeuft"-Banner, Kalorien-Gauge, **WASSER**, **Tagesziele**, **Challenges**, Schnellzugriff, Erfolge
           TrainingScreen – HUB: Freies Training (Koerper->Uebungen->Detail) | Plan
           PlanScreen – Trainingsplan: Uebungen ANTIPPBAR -> ExerciseDetail, ✓ heute erledigt, Zielmuskel; Muskel via separater muscles-Abfrage (NICHT nested embed -> mehrdeutig!)
           EssenScreen – HUB: Tracker | Ernaehrungsplan
           FoodTrackerScreen – Essens-Tagebuch + **Wasser-Tracker** (embedded-faehig)
           NutritionScreen · ProgressScreen · SettingsScreen (Dark-Mode, **ERINNERUNGEN**, Profil-Unterseite) · ProfileScreen (inkl. Erfahrungslevel + Trainingsumgebung)
  db/*.sql – schema + 002..009
```
**Filter (Training/Plan):** `ALLOWED_DIFF[experience_level]` (beginner/some/advanced/pro) +
`ALLOWED_EQUIP[training_environment]`: gym=alle; home_gym=dumbbell/bodyweight/none/other; no_equipment=bodyweight/none.
**Wasser:** `WATER_GOAL=2500` ml; `water_logs` (heute summiert); +250/+500/Undo; Home+Tracker synchron.

## 8. Roadmap (offen)
1. Eigene Rezepte/Mahlzeiten speichern & tracken.
2. Erfolge/Badges dauerhaft speichern (mit Freischalt-Hinweis).
3. **Dev-Build (EAS)** für echte Erinnerungen (iOS: Apple-Konto 99 $/Jahr) und Veröffentlichung.
4. API-Key per Server-Proxy verstecken (vor Release).

## 9./10. Befehle & Git
- Handy: `npx expo start` (`-c` nach Wechsel). LAN-IP via `Get-NetIPConfiguration`. exp-URL `exp://<IP>:8081`.
  QR via api.qrserver.com → `build/expo-qr.png` (gitignored) → mit Read anzeigen.
- Typecheck: `npx tsc --noEmit`. SQL: Nutzer im Supabase SQL Editor.
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`. Auth via PAT.
  Commit-Messages enden mit `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## 11. Empfohlener nächster Schritt
Sicherstellen, dass **008 & 009** ausgeführt sind. Dann mit Nutzer abstimmen (eigene Rezepte oder
Erfolge dauerhaft). Für echte Erinnerungen: Dev-Build planen.
