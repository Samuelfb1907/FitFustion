# HANDOVER – FitFusion (Projekt-Übergabe für Claude)

> **Zweck:** Dieses Dokument fasst den **kompletten Projektstand** zusammen, damit eine
> **neue Claude-Session ohne Vorwissen** sofort produktiv weiterarbeiten kann.
> In einem neuen Chat einfach einfügen oder Claude darauf verweisen.
>
> *Stand: Auth, Onboarding, Ernährungsbedarf, Training-Hub (klickbarer Körper, Logging,
> Auto-Plan), Essen-Hub (Tracker + Ernährungsplan), Fortschritts-Dashboard, Dark Mode,
> Gamification. Läuft im Browser UND auf dem Handy (Expo Go, SDK 54).*

---

## 0. Aktueller Stand & Wiedereinstieg
- **Letzter Stand:** Großer Umbau auf **5 Reiter mit Hubs** + **realistischer, klickbarer Körper** + **Fortschritts-Dashboard** + Handy-Lauffähigkeit (Expo Go).
  - **5 Reiter:** Start · Training · Essen · Fortschritt · Einstellungen.
  - **Training-Hub:** oben umschalten **Freies Training** (realistischer Körper → Muskel antippen → Übungen → Detail) ↔ **Trainingsplan**.
  - **Essen-Hub:** oben umschalten **Tracker** ↔ **Ernährungsplan**.
  - **Fortschritt:** Gewichtsverlauf (mit Eingabe), Wochenvolumen, persönliche Rekorde, Historie.
  - **Körper:** `react-native-body-highlighter` (echte Anatomie), Vorder-/Rückseite, **männlich/weiblich je Profil-Geschlecht**.
  - **Training beenden:** Button in ExerciseDetail **und** als Banner auf der Startseite (nutzt `workout_sessions.ended_at`, Migration 007).
- **⚠️ WICHTIG – SDK ist bewusst auf 54 (nicht höher!):** Die Expo-Go-App auf dem iPhone des Nutzers unterstützt nur **SDK 54**. Das Projekt wurde von SDK 56 → **54** heruntergestuft, damit es auf dem Handy läuft. **Nicht** auf ein neueres SDK upgraden, sonst „incompatible with this version of Expo Go" auf dem Handy. (Alternativen für neuere SDKs: neuere Expo Go installieren – auf iOS oft nicht möglich – oder Dev-Build via EAS.)
- **Am Handy testen:** in `app/` → `npx expo start` (LAN). Link = `exp://<PC-LAN-IP>:8081`; iPhone-Kamera scannt den QR. Details s. Abschnitt 9.
- **Im Browser testen:** `build\Start-FitFusion-Web.cmd` (Port 8081) **oder** `npx expo start --web`.
- **Build:** `npx tsc --noEmit` lief zuletzt fehlerfrei (Node-PATH vorher setzen, s. Abschnitt 3).
- **⚠️ Offener DB-Schritt (stateful prüfen):** Migrationen `schema.sql` + `002`–**`007`** müssen im Supabase SQL Editor angewendet sein. **`007_session_end.sql`** fügt `workout_sessions.ended_at` hinzu (für „Training beenden"). Falls der Beenden-Knopf/Banner nicht erscheint → 007 ausführen.
- **Nächster Schritt:** offen – mit Nutzer abstimmen (Roadmap s. Abschnitt 8).

---

## 1. Projekt in einem Satz
**FitFusion** ist eine mobile Fitness- & Ernährungs-App (Expo/React Native + Supabase), die
Trainings- und Ernährungspläne personalisiert verbindet. Produktvision: `FitFusion-Masterfile.docx`.

## 2. Arbeitsweise mit dem Nutzer (wichtig)
- Der Nutzer ist **Programmier-Anfänger**.
- Modus: **„Claude richtet ein und erklärt jeden Schritt"** – Claude macht so viel wie möglich
  selbst; der Nutzer übernimmt nur, was nur er kann (Konten, Browser-/Handy-Klicks, SQL im Supabase-Dashboard).
- **Sprache: Deutsch.** Klar, schrittweise, mit kurzer Begründung.
- Ablauf je Feature: bauen → `npx tsc --noEmit` → testen lassen (Browser/Handy) → auf GitHub committen.

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
  `$env:GIT_TERMINAL_PROMPT='0'` setzen.
- **Dev-Server im Hintergrund** zeigt KEINEN QR/keine `exp://`-URL im Output (nur „Waiting on
  http://localhost:8081"). Die `exp://`-URL selbst zusammenbauen: `exp://<PC-LAN-IP>:8081`.

## 4. Tech-Stack
| Bereich | Wahl |
|---|---|
| Frontend | **Expo SDK 54**, React Native 0.81.5, React 19.1.0, TypeScript 5.9 |
| Backend/DB | Supabase (PostgreSQL, Auth, Row Level Security) |
| Wichtige Libs | `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, **`react-native-svg`** (15.12.1), **`react-native-body-highlighter`** (3.2.0, Körper-Map) |
| Web-Preview | `react-dom`, `react-native-web`, `@expo/metro-runtime` |
| Repo | GitHub `Samuelfb1907/FitFustion`, Branch `main` |
- **SDK-Versionierung:** Mit `npx expo install <pkg>` / `npx expo install --fix` installieren, damit alle
  Pakete zur SDK-Version passen. SDK-Wechsel: `npx expo install expo@~54.0.x` dann `npx expo install --fix`.
  **Aktuell auf SDK 54 festgelegt (Handy-Kompatibilität, s. Abschnitt 0).**

## 5. Supabase
- Projekt-Ref: `ugofjmdwjcrjvakilmsu` · URL: `https://ugofjmdwjcrjvakilmsu.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/ugofjmdwjcrjvakilmsu`
- Schlüssel (Publishable Key) in **`app/.env`** (NICHT eingecheckt): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **E-Mail-Bestätigung deaktiviert** (Auth → Providers → Email). Region: Frankfurt.
- **Datenbank-Passwort / service_role-Key:** niemals teilen, werden von der App nicht gebraucht.

## 6. Datenbank (17 Tabellen) + Migrationen
- Reihenfolge im SQL Editor: `schema.sql` → `002_allergies` → `003_more_exercises` →
  `004_more_exercises` → `005_food_tracking` → `006_foods_500plus` → **`007_session_end`**
  (alle in `app/db/`, idempotent).
- **007** = `alter table workout_sessions add column if not exists ended_at timestamptz;`
- Tabellen: profiles, goals, muscles, exercises, exercise_muscles, workout_plans,
  workout_plan_days, workout_plan_exercises, workout_sessions (**+ended_at**), set_logs,
  nutrition_plans, meals, progress_entries, achievements, user_achievements, foods, food_logs.
- **RLS überall** (`auth.uid() = user_id`); Referenzdaten (muscles/exercises/foods/...) öffentlich lesbar.
- Trigger `handle_new_user` legt bei Registrierung automatisch eine `profiles`-Zeile an.
- Inhalte: ~68 Übungen (alle Muskeln), **540+ Zutaten** in `foods`, Seed-Achievements.

## 7. App-Struktur (aktuell)
```
app/
  App.tsx                       Routing (loading -> Auth / Onboarding / MainTabs), Theme+Auth Provider
  contexts/AuthContext.tsx      session + profile {id, first_name, gender, experience_level, training_environment}
  contexts/ThemeContext.tsx     Dark-/Light-Theme (useColors/useTheme); Tokens inkl. accent/hero/muscle
  components/ExerciseDetail.tsx  Übungsdetail + Sätze mitschreiben + "Training beenden"
  components/CalorieGauge.tsx    animierte Halbkreis-Kalorien-Gauge (svg)
  components/Charts.tsx          LineChart + BarChart (svg) fuer das Fortschritts-Dashboard
  components/Segmented.tsx       Pillen-Umschalter (fuer die Hubs)
  components/BodyMuscleMap.tsx   realistischer Koerper (react-native-body-highlighter): Muskel antippen,
                                 Vorder-/Rueckseite, gender m/w; Slug<->DB-Key-Mapping; svg noetig
  lib/supabase.ts | nutrition.ts | meals.ts | gamification.ts
  screens/AuthScreen.tsx        Login/Registrierung
  screens/OnboardingScreen.tsx  5 Schritte (Daten, Allergien[39], Erfahrung, Umgebung, Ziel)
  screens/MainTabs.tsx          5 Reiter: Start | Training | Essen | Fortschritt | Einstellungen
                                 (iOS: paddingBottom 30 fuer Home-Leiste / Safe-Area)
  screens/HomeScreen.tsx        Dashboard: Hero (Level/Streak/XP), "Training laeuft"-Banner+Beenden,
                                 Kalorien-Gauge, Schnellzugriff (onNavigate), Erfolge
  screens/TrainingScreen.tsx    HUB: Freies Training (BodyMuscleMap -> Uebungen -> Detail) | Plan (PlanScreen embedded)
  screens/PlanScreen.tsx        Auto-Trainingsplan (embedded-faehig)
  screens/EssenScreen.tsx       HUB: Tracker (FoodTracker) | Ernaehrungsplan (Nutrition), beide embedded
  screens/NutritionScreen.tsx   Ernaehrungsplan (embedded-faehig)
  screens/FoodTrackerScreen.tsx Kalorien-Tracker (embedded-faehig)
  screens/ProgressScreen.tsx    Fortschritt: Gewichtsverlauf (Eingabe), Wochenvolumen, Rekorde, Historie
  screens/SettingsScreen.tsx    Einstellungen + Dark-Mode + Profil-Unterseite
  screens/ProfileScreen.tsx     Profil/Daten bearbeiten
  db/*.sql                      schema + 002..007
```
**Wichtige Logik:**
- **AuthContext (Deadlock-Hinweis!):** im `onAuthStateChange`-Callback NIE `await` auf Supabase-Aufrufe
  (App lädt sonst endlos). Profil in separatem useEffect laden. Onboarding-fertig = `profiles.experience_level != null`.
  Geladene Spalten = `PROFILE_COLUMNS` (enthält jetzt auch **gender**).
- **Hubs / `embedded`-Prop:** Plan/Nutrition/FoodTracker akzeptieren `embedded` → kein eigener Titel,
  `paddingTop/Horizontal` reduziert; der Hub liefert Titel + `Segmented`.
- **Körper-Map:** `BodyMuscleMap` bekommt `gender` (aus `profile.gender === 'female' ? 'female' : 'male'`).
  Slug→Key: deltoids→shoulders, trapezius/upper-back/lower-back→back, quadriceps/hamstring/adductors→legs,
  obliques→abs, gluteal→glutes (Rest 1:1). Anklickbare Muskeln nur **dezent** getönt, gewählter klar markiert.
  Tap → Muskel „picken" (Highlight) → Button „Übungen anzeigen". Liste darunter als Alternative.
- **Training-Session:** aktiv = `workout_sessions` von heute mit `ended_at IS NULL`. ExerciseDetail/Start-Banner
  setzen `ended_at` zum Beenden; der nächste Satz startet automatisch eine neue Session. (Migration 007 nötig.)
- **Filter-Logik** (TrainingScreen + PlanScreen): `ALLOWED_DIFF` (experience_level) und `ALLOWED_EQUIP`
  (training_environment) steuern Übungsauswahl/Plan.
- **Auto-Plan / Ernährungsplan / Tracker:** wie gehabt (set_logs, nutrition_plans/meals, foods/food_logs).
- **Safe-Area:** Tab-Leiste hat auf iOS `paddingBottom: 30` (kein `react-native-safe-area-context` installiert).

## 8. Fertig (✅) / Offen (⬜)
**✅ Erledigt**
- Node + Expo, Web-Preview **und Handy (Expo Go, SDK 54)**; Supabase-DB (17 Tabellen, RLS, Trigger, Seed) + Migrationen 002–007
- Login / Registrierung / Logout; Onboarding (5 Schritte inkl. 39 Allergien)
- 5-Tab-Navigation mit **Training-Hub** und **Essen-Hub**
- Täglicher Kalorien-/Makrobedarf; Trainingsbereich (Muskeln → ~68 gefilterte Übungen → Detail)
- **Realistischer, klickbarer Körper** (m/w nach Geschlecht) zur Muskelauswahl
- Training mitschreiben (Sätze) + **„Training beenden"** (ExerciseDetail + Start-Banner)
- Automatischer Trainingsplan; Ernährungsplan (allergikersicher); Kalorien-Tracker (540+ Zutaten)
- **Gamification** (Level/XP, Streak, Erfolge) + animierte Kalorien-Gauge
- **Fortschritts-Dashboard** (`screens/ProgressScreen.tsx`, `components/Charts.tsx`): Gewichtsverlauf
  (Eingabe aktualisiert auch `profiles.weight_kg`), Wochenvolumen, persönliche Rekorde, Historie
- **Dark Mode / Theme** + **Einstellungen** (mit Profil-Unterseite)
- Alles auf GitHub

**⬜ Nächste Bausteine (Roadmap)**
1. **Tagesziele & Challenges** + persistente Erfolge mit Freischalt-Hinweis.
2. **Eigene Rezepte/Mahlzeiten** speichern & tracken; makro-genauerer Ernährungsplan.
3. **Premium-Funktionen** (KI-Coach etc., siehe Masterfile).
4. **Übungs-Animationen / Bilder**.
5. **Neuere SDKs / Standalone-App:** Dev-Build via EAS (dann nicht mehr an Expo-Go-SDK gebunden).

## 9. Befehle (Spickzettel)
- Node-PATH: `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`
- **Handy (Expo Go):** in `app/` → `npx expo start` (nach Versionswechsel `npx expo start -c`).
  PC-LAN-IP finden: `Get-NetIPConfiguration | ? {$_.IPv4DefaultGateway -ne $null}`. Link = `exp://<IP>:8081`.
  QR erzeugen: `Invoke-WebRequest "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=exp%3A%2F%2F<IP>%3A8081" -OutFile build\expo-qr.png` (gitignored), dann mit `Read` anzeigen/scannen.
  Manifest-Check übers Netz: `Invoke-WebRequest http://<IP>:8081/ -Headers @{'expo-platform'='ios'}` → JSON mit `sdkVersion`.
  Bei Verbindungsproblemen (Firewall/WLAN): `npx expo start --tunnel` (braucht `@expo/ngrok`).
- **Browser:** `build\Start-FitFusion-Web.cmd` (Port 8081) oder `npx expo start --web`.
- **Typecheck:** in `app/` → `npx tsc --noEmit`.
- **Speichern:** `git add -A` → `git commit -m "..."` → `git push` (`$env:GIT_TERMINAL_PROMPT='0'`).
- **DB ändern:** SQL schreiben → Nutzer führt es im Supabase **SQL Editor** aus (per `Set-Clipboard` liefern).

## 10. Git / GitHub
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`.
- Commit-Identität: `Samuel <Samuelfb1907@users.noreply.github.com>`.
- Commit-Messages enden mit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Auth über Personal Access Token (Windows-Anmeldespeicher). Bei Ablauf neuen fine-grained PAT
  (Repo „FitFustion", Contents: Read and write) erstellen.

## 11. Empfohlener nächster Schritt
Mit dem Nutzer abstimmen. Naheliegend & motivierend: **Tagesziele & Challenges** oder
**eigene Rezepte/Mahlzeiten speichern**. (Beides baut auf vorhandenen Daten/Screens auf.)
