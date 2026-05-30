# HANDOVER – FitFusion (Projekt-Übergabe für Claude)

> **Zweck:** Dieses Dokument fasst den **kompletten Projektstand** zusammen, damit eine
> **neue Claude-Session ohne Vorwissen** sofort produktiv weiterarbeiten kann.
> In einem neuen Chat einfach einfügen oder Claude darauf verweisen.
>
> *Stand: Auth, Onboarding, Ernährungsbedarf, Trainingsbereich (Übungen, Logging, Auto-Plan),
> Ernährungsplan und Kalorien-Tracker (540+ Zutaten).*

---

## 1. Projekt in einem Satz
**FitFusion** ist eine mobile Fitness- & Ernährungs-App (Expo/React Native + Supabase), die
Trainings- und Ernährungspläne personalisiert verbindet. Produktvision: `FitFusion-Masterfile.docx`.

## 2. Arbeitsweise mit dem Nutzer (wichtig)
- Der Nutzer ist **Programmier-Anfänger**.
- Modus: **„Claude richtet ein und erklärt jeden Schritt"** – Claude macht so viel wie möglich
  selbst; der Nutzer übernimmt nur, was nur er kann (Konten, Browser-Klicks, SQL im Supabase-Dashboard).
- **Sprache: Deutsch.** Klar, schrittweise, mit kurzer Begründung.
- Ablauf je Feature: bauen → `npx tsc --noEmit` → im Browser testen lassen → auf GitHub committen.

## 3. Umgebung (Windows) – Stolpersteine
- OS: **Windows**, Shell: **PowerShell 5.1**. Arbeitsverzeichnis: `C:\Users\Samuel\fitness-app`
- **Node.js v24 liegt PORTABEL** unter `C:\Users\Samuel\tools\node`, NICHT im Standard-PATH.
  Vor node/npm/npx immer: `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`
- Kein globales Node/Python, kein LibreOffice, **kein Supabase-MCP-Connector**.
  → DB-Änderungen als SQL liefern; **Nutzer führt sie im Supabase SQL Editor aus**
  (bewährt: SQL per `Set-Clipboard` in die Zwischenablage legen).
- **PowerShell 5.1 liest Dateien ohne BOM als ANSI** → Inline-PowerShell-Befehle und `.ps1`
  **ASCII halten** (keine Umlaute inline). UTF-8-Dateien mit `Get-Content -Encoding UTF8`.
  Umlaute in `.sql`/`.tsx`/`.md` sind dagegen ok (werden nicht inline geparst).
- Git-Auth via Personal Access Token (im Windows-Anmeldespeicher); bei Git-Befehlen
  `$env:GIT_TERMINAL_PROMPT='0'` setzen. Entwicklung im **Browser**: `build\Start-FitFusion-Web.cmd` (Port 8081).

## 4. Tech-Stack
| Bereich | Wahl |
|---|---|
| Frontend | Expo SDK 56, React Native 0.85, React 19.2, TypeScript |
| Backend/DB | Supabase (PostgreSQL, Auth, Row Level Security) |
| Wichtige Libs | `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` |
| Web-Preview | `react-dom`, `react-native-web`, `@expo/metro-runtime` |
| Repo | GitHub `Samuelfb1907/FitFustion`, Branch `main` |

## 5. Supabase
- Projekt-Ref: `ugofjmdwjcrjvakilmsu` · URL: `https://ugofjmdwjcrjvakilmsu.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/ugofjmdwjcrjvakilmsu`
- Schlüssel (Publishable Key) in **`app/.env`** (NICHT eingecheckt): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **E-Mail-Bestätigung deaktiviert** (Auth → Providers → Email). Region: Frankfurt.

## 6. Datenbank (17 Tabellen) + Migrationen
- Reihenfolge im SQL Editor: `schema.sql` → `002_allergies` → `003_more_exercises` →
  `004_more_exercises` → `005_food_tracking` → `006_foods_500plus` (alle in `app/db/`, idempotent).
- Tabellen: profiles, goals, muscles, exercises, exercise_muscles, workout_plans,
  workout_plan_days, workout_plan_exercises, workout_sessions, set_logs, nutrition_plans,
  meals, progress_entries, achievements, user_achievements, **foods**, **food_logs**.
- **RLS überall** (`auth.uid() = user_id`); Referenzdaten (muscles/exercises/foods/...) öffentlich lesbar.
- Trigger `handle_new_user` legt bei Registrierung automatisch eine `profiles`-Zeile an.
- Inhalte: ~68 Übungen (alle Muskeln), **540+ Zutaten** in `foods`, Seed-Achievements.

## 7. App-Struktur (aktuell)
```
app/
  App.tsx                       Routing: loading -> AuthScreen / OnboardingScreen / MainTabs
  contexts/AuthContext.tsx      session + profile (Deadlock-Hinweis s. u.)
  components/ExerciseDetail.tsx Übungsdetail + Training mitschreiben (Sätze)
  lib/supabase.ts               Supabase-Client
  lib/nutrition.ts              BMR/TDEE/Makros (Mifflin-St Jeor, reine Funktionen)
  lib/meals.ts                  Mahlzeiten-Bibliothek + Ernährungsplan-Generator
  screens/AuthScreen.tsx        Login/Registrierung
  screens/OnboardingScreen.tsx  5 Schritte (Daten, Allergien[39], Erfahrung, Umgebung, Ziel)
  screens/MainTabs.tsx          Tab-Leiste: Start | Training | Plan | Ernährung | Tracker
  screens/HomeScreen.tsx        Tages-Kalorien-/Makrobedarf
  screens/TrainingScreen.tsx    Muskelraster -> gefilterte Übungen
  screens/PlanScreen.tsx        automatischer Trainingsplan
  screens/NutritionScreen.tsx   Ernährungsplan (Mahlzeiten zu Makros, allergikersicher)
  screens/FoodTrackerScreen.tsx Kalorien-Tracker (Zutaten + Mengen, Tagessumme)
  db/*.sql
```
**Wichtige Logik:**
- **AuthContext (Deadlock-Hinweis!):** im `onAuthStateChange`-Callback NIE `await` auf Supabase-Aufrufe
  (App lädt sonst endlos). Profil in separatem useEffect laden. Onboarding-fertig = `profiles.experience_level != null`.
- **Filter-Logik** (TrainingScreen + PlanScreen): `ALLOWED_DIFF` (experience_level) und `ALLOWED_EQUIP`
  (training_environment) steuern Übungsauswahl/Plan.
- **Logging:** ExerciseDetail legt bei Bedarf eine Tages-Session an (`workout_sessions`) + Sätze (`set_logs`).
- **Auto-Plan:** PlanScreen nutzt Split-Vorlagen je Tagesanzahl, füllt Übungen, speichert in `workout_plans/_days/_exercises`.
- **Ernährungsplan:** lib/meals.ts wählt allergikersichere Mahlzeiten und skaliert sie auf das Kalorienziel; speichert in `nutrition_plans/meals`.
- **Tracker:** FoodTrackerScreen → Zutat aus `foods` wählen, Menge (g) → `food_logs`; Tagessumme vs. Ziel.

## 8. Fertig (✅) / Offen (⬜)
**✅ Erledigt**
- Node + Expo, Web-Preview; Supabase-DB (17 Tabellen, RLS, Trigger, Seed) + Migrationen 002–006
- Login / Registrierung / Logout
- Onboarding (5 Schritte inkl. 39 Allergien)
- Tab-Navigation (5 Tabs)
- Täglicher Kalorien-/Makrobedarf (`lib/nutrition.ts`)
- Trainingsbereich (Muskeln → ~68 gefilterte Übungen → Detail)
- Training mitschreiben (Sätze)
- Automatischer Trainingsplan
- Ernährungsplan (Mahlzeiten zu Makros, allergikersicher)
- Kalorien-Tracker mit 540+ Zutaten
- Alles auf GitHub

**⬜ Nächste Bausteine (Roadmap)**
1. **Fortschritts-Dashboard** – Trainingshistorie/Volumen (`set_logs`), persönliche Rekorde,
   Gewichtsverlauf (`progress_entries`; dafür Gewicht-Eingabe ergänzen).
2. **Gamification** – XP/Badges/Streaks (`achievements`, `user_achievements`).
3. **Premium-Funktionen** (KI-Coach etc., siehe Masterfile).
4. **Makro-genauerer Ernährungsplan** & eigene Rezepte/Mahlzeiten speichern.
5. **Visuelle 3D-Muskelkarte** (aktuell ein Raster) und **Übungs-Animationen**.
6. **Handy/Expo Go**: SDK-56-Mismatch ungelöst → Projekt-SDK anpassen oder Dev-Build (EAS).

## 9. Befehle (Spickzettel)
- Web starten: `build\Start-FitFusion-Web.cmd` doppelklicken (Port 8081).
- Typecheck: in `app/` → `npx tsc --noEmit` (vorher Node-PATH setzen).
- Speichern: `git add -A` → `git commit -m "..."` → `git push` (Credentials gespeichert; `GIT_TERMINAL_PROMPT=0`).
- DB ändern: SQL schreiben → Nutzer führt es im Supabase **SQL Editor** aus.

## 10. Git / GitHub
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`.
- Commit-Identität: `Samuel <Samuelfb1907@users.noreply.github.com>`.
- Auth über Personal Access Token (Windows-Anmeldespeicher). Bei Ablauf neuen fine-grained PAT
  (Repo „FitFustion", Contents: Read and write) erstellen.

## 11. Empfohlener nächster Schritt
**Fortschritts-Dashboard** – macht die mitgeschriebenen Trainings (`set_logs`) und den
Gewichtsverlauf (`progress_entries`) sichtbar; motivierend und baut auf vorhandenen Daten auf.
