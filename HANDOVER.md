# HANDOVER – FitFusion (Projekt-Übergabe für Claude)

> **Zweck:** Dieses Dokument fasst den **kompletten Projektstand** zusammen, damit eine
> **neue Claude-Session ohne Vorwissen** sofort produktiv weiterarbeiten kann.
> In einem neuen Chat einfach den Inhalt einfügen oder Claude darauf verweisen.
>
> *Stand: Auth, Onboarding, Ernährungsbedarf, kompletter Trainingsbereich (Übungen, Logging, automatischer Plan).*

---

## 1. Projekt in einem Satz
**FitFusion** ist eine mobile Fitness- & Ernährungs-App (Expo/React Native + Supabase), die
Trainings- und Ernährungspläne personalisiert verbindet. Produktvision: `FitFusion-Masterfile.docx`.

## 2. Arbeitsweise mit dem Nutzer (wichtig)
- Der Nutzer ist **Programmier-Anfänger**.
- Gewünschter Modus: **„Claude richtet ein und erklärt jeden Schritt"** – Claude macht so viel
  wie möglich selbst; der Nutzer übernimmt nur, was nur er kann (Konten, Browser-Klicks,
  SQL im Supabase-Dashboard ausführen).
- **Sprache: Deutsch.** Antworten klar, schrittweise, mit kurzer Begründung.
- Bewährter Ablauf je Feature: bauen → `npx tsc --noEmit` prüfen → im Browser testen lassen →
  auf GitHub committen/pushen.

## 3. Umgebung (Windows) – Stolpersteine
- OS: **Windows**, Shell: **PowerShell 5.1**. Arbeitsverzeichnis: `C:\Users\Samuel\fitness-app`
- **Node.js v24 liegt PORTABEL** unter `C:\Users\Samuel\tools\node`, NICHT im Standard-PATH.
  Vor node/npm/npx immer: `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`
- Kein globales Node/Python, kein LibreOffice, **kein Supabase-MCP-Connector**.
  → DB-Änderungen als SQL liefern; der **Nutzer führt sie im Supabase SQL Editor aus**
  (bewährt: SQL per `Set-Clipboard` in die Zwischenablage legen).
- **PowerShell 5.1 liest Dateien ohne BOM als ANSI** → Inline-PowerShell-Befehle und `.ps1`
  **ASCII halten** (keine Umlaute inline, sonst Parser-Fehler). UTF-8-Dateien mit `Get-Content -Encoding UTF8`.
- GUI-Popups erscheinen bei direkten Tool-Aufrufen oft nicht → Git-Auth läuft über Personal Access Token
  (im Windows-Anmeldespeicher hinterlegt), bei Git-Befehlen `$env:GIT_TERMINAL_PROMPT='0'` setzen.
- Entwicklung läuft im **Browser** (`build\Start-FitFusion-Web.cmd`). Metro/Web auf Port 8081.

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
- **E-Mail-Bestätigung deaktiviert** (Auth → Providers → Email) für einfaches Test-Login. Region: Frankfurt.

## 6. Datenbank (15 Tabellen) + Migrationen
- Schema: `app/db/schema.sql` (idempotent). Migrationen: `002_allergies.sql` (Spalte `allergies text[]`),
  `003_more_exercises.sql` + `004_more_exercises.sql` (zusammen ~68 Übungen über alle Muskeln).
- Tabellen: `profiles, goals, muscles, exercises, exercise_muscles, workout_plans, workout_plan_days,
  workout_plan_exercises, workout_sessions, set_logs, nutrition_plans, meals, progress_entries,
  achievements, user_achievements`.
- **RLS auf allen Tabellen** (`auth.uid() = user_id`); Referenzdaten (muscles/exercises/...) öffentlich lesbar.
- Trigger `handle_new_user` legt bei Registrierung automatisch eine `profiles`-Zeile an.
- `profiles`: first_name, birth_date, gender, height_cm, weight_kg, activity_level, allergies (text[]),
  experience_level, training_environment.

## 7. App-Struktur (aktuell)
```
app/
  App.tsx                       Routing: loading -> AuthScreen / OnboardingScreen / MainTabs
  contexts/AuthContext.tsx      session + profile (Deadlock-Hinweis s. u.)
  components/ExerciseDetail.tsx Übungsdetail + Training mitschreiben (Sätze)
  lib/supabase.ts               Supabase-Client
  lib/nutrition.ts              BMR/TDEE/Makros (Mifflin-St Jeor, reine Funktionen)
  screens/AuthScreen.tsx        Login/Registrierung
  screens/OnboardingScreen.tsx  5 Schritte (Daten, Allergien[39], Erfahrung, Umgebung, Ziel)
  screens/MainTabs.tsx          untere Tab-Leiste: Start | Training | Plan (state-basiert)
  screens/HomeScreen.tsx        Tages-Kalorien-/Makrobedarf-Karte
  screens/TrainingScreen.tsx    Muskelraster -> gefilterte Übungsliste -> ExerciseDetail
  screens/PlanScreen.tsx        automatischer Trainingsplan (Generator + Anzeige)
  db/*.sql
```
**Wichtige Logik:**
- **AuthContext (Deadlock-Hinweis!):** im `onAuthStateChange`-Callback NIE `await` auf Supabase-Aufrufe
  (Deadlock → App lädt endlos). Profil wird in separatem useEffect geladen. Onboarding-fertig = `profiles.experience_level != null`.
- **Filter-Logik** (gleich in TrainingScreen + PlanScreen): `ALLOWED_DIFF` (nach experience_level) und
  `ALLOWED_EQUIP` (nach training_environment) bestimmen, welche Übungen angezeigt/eingeplant werden.
- **Logging:** ExerciseDetail legt bei Bedarf eine Tages-Session an (`workout_sessions`) und speichert Sätze (`set_logs`).
- **Plan-Generator:** PlanScreen nutzt feste Split-Vorlagen je Tagesanzahl (2–6) und füllt jeden Tag mit
  bis zu 2 passenden Übungen pro Muskel; speichert in `workout_plans/_days/_exercises`.

## 8. Fertig (✅) / Offen (⬜)
**✅ Erledigt**
- Node + Expo, Web-Preview; Supabase-DB (15 Tabellen, RLS, Trigger, Seed) + Migrationen 002–004
- Registrierung / Login / Logout (Session bleibt erhalten)
- Onboarding (5 Schritte inkl. 39 Allergien) → `profiles` + `goals`
- Tab-Navigation (Start / Training / Plan)
- Home: täglicher **Kalorien-/Makrobedarf** (`lib/nutrition.ts`, Mifflin-St Jeor)
- **Trainingsbereich:** Muskelauswahl → gefilterte Übungen (~68) → Detail
- **Training mitschreiben** (Sätze: Wdh + Gewicht → `workout_sessions`/`set_logs`)
- **Automatischer Trainingsplan** (Split nach Tagen, gefüllt mit passenden Übungen, gespeichert)
- Alles auf GitHub

**⬜ Nächste Bausteine (Roadmap)**
1. **Fortschritts-Dashboard** – Trainingshistorie/Volumen (aus `set_logs`), persönliche Rekorde,
   Gewichtsverlauf (`progress_entries`; dafür Gewicht-Eingabe ergänzen).
2. **Ernährungsplan** – konkrete Mahlzeiten zu den berechneten Makros, inkl. Allergie-Berücksichtigung
   (`nutrition_plans`, `meals`).
3. **Gamification** – XP/Badges/Streaks (`achievements`, `user_achievements`).
4. **Premium-Funktionen** (KI-Coach etc., siehe Masterfile).
5. **Interaktive 3D-/visuelle Muskelkarte** (aktuell ein Raster) und **Übungs-Animationen**.
6. **Handy/Expo Go**: SDK-56-Mismatch mit Store-Expo-Go ungelöst → Projekt-SDK anpassen oder Dev-Build (EAS).

## 9. Befehle (Spickzettel)
- Web starten: `build\Start-FitFusion-Web.cmd` doppelklicken (Port 8081).
- Typecheck: in `app/` → `npx tsc --noEmit` (vorher Node-PATH setzen).
- Speichern: `git add -A` → `git commit -m "..."` → `git push` (Credentials gespeichert; `GIT_TERMINAL_PROMPT=0`).
- DB ändern: SQL schreiben → Nutzer führt es im Supabase **SQL Editor** aus.

## 10. Git / GitHub
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`.
- Commit-Identität: `Samuel <Samuelfb1907@users.noreply.github.com>`.
- Auth über Personal Access Token (im Windows-Anmeldespeicher). Bei Ablauf neuen fine-grained PAT
  (Repo „FitFustion", Contents: Read and write) erstellen.

## 11. Empfohlener nächster Schritt
**Fortschritts-Dashboard** – macht die mitgeschriebenen Trainings + den Gewichtsverlauf sichtbar
(nutzt `set_logs` und `progress_entries`). Alternativ der **Ernährungsplan** (Mahlzeiten zu den Makros).
