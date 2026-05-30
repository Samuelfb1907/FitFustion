# HANDOVER – FitFusion (Projekt-Übergabe für Claude)

> **Zweck:** Dieses Dokument fasst den **kompletten Projektstand** zusammen, damit eine
> **neue Claude-Session ohne Vorwissen** sofort produktiv weiterarbeiten kann.
> In einem neuen Chat einfach den Inhalt dieser Datei einfügen oder Claude darauf verweisen.
>
> *Stand: nach Aufbau von Fundament, Login und Onboarding.*

---

## 1. Projekt in einem Satz
**FitFusion** ist eine mobile Fitness- & Ernährungs-App (Expo/React Native + Supabase), die
Trainings- und Ernährungspläne personalisiert verbindet. Aktuell steht das **Fundament**:
Auth, Onboarding und Datenbank. Die Produktvision liegt in `FitFusion-Masterfile.docx`.

## 2. Arbeitsweise mit dem Nutzer (wichtig)
- Der Nutzer ist **Programmier-Anfänger**.
- Gewünschter Modus: **„Claude richtet ein und erklärt jeden Schritt"** – Claude macht so viel
  wie möglich selbst; der Nutzer übernimmt nur, was nur er kann (Konten anlegen, Browser-Klicks,
  SQL im Supabase-Dashboard ausführen).
- **Sprache: Deutsch.** Antworten klar, schrittweise, mit kurzen Erklärungen des „Warum".

## 3. Umgebung (Windows) – Stolpersteine
- OS: **Windows**, Shell: **PowerShell 5.1**. Arbeitsverzeichnis: `C:\Users\Samuel\fitness-app`
- **Node.js v24 liegt PORTABEL** unter `C:\Users\Samuel\tools\node` und ist **nicht** im Standard-PATH.
  Vor jedem node/npm/npx-Aufruf zuerst:
  `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`
- Kein globales Node/Python, kein LibreOffice, **kein Supabase-MCP-Connector**.
  → DB-Änderungen liefert Claude als SQL; der **Nutzer führt sie im Supabase SQL Editor aus**
  (bewährt: SQL per `Set-Clipboard` in die Zwischenablage kopieren).
- **PowerShell 5.1 liest Skript-/Dateien ohne BOM als ANSI** → Inline-Befehle und `.ps1`-Inhalte
  **ASCII halten** (keine Umlaute in inline-PowerShell, sonst Parser-Fehler). `Get-Content` für
  UTF-8-Dateien mit `-Encoding UTF8`.
- GUI-Popups (z. B. GitHub-Login von Git Credential Manager) erscheinen bei *direkten* Tool-Aufrufen
  oft **nicht** → für Git-Auth Personal Access Token nutzen (siehe Abschnitt 10).

## 4. Tech-Stack
| Bereich | Wahl |
|---|---|
| Frontend | Expo SDK 56, React Native 0.85, React 19.2, TypeScript |
| Backend/DB | Supabase (PostgreSQL, Auth, Row Level Security) |
| Wichtige Libs | `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` |
| Web-Preview | `react-dom`, `react-native-web`, `@expo/metro-runtime` |
| Repo | GitHub `Samuelfb1907/FitFustion`, Branch `main` |

## 5. Supabase
- Projekt-Ref: `ugofjmdwjcrjvakilmsu`
- API-URL: `https://ugofjmdwjcrjvakilmsu.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/ugofjmdwjcrjvakilmsu`
- Schlüssel (Publishable Key) stehen in **`app/.env`** (NICHT eingecheckt). Variablen:
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **E-Mail-Bestätigung ist für die Entwicklung deaktiviert** (Auth → Providers → Email).
- Region: Europe (Frankfurt).

## 6. Datenbank (15 Tabellen)
- Hauptschema: **`app/db/schema.sql`** (idempotent). Migration: **`app/db/002_allergies.sql`**
  (fügt Spalte `allergies text[]` zu `profiles` hinzu).
- Tabellen: `profiles, goals, muscles, exercises, exercise_muscles, workout_plans,
  workout_plan_days, workout_plan_exercises, workout_sessions, set_logs, nutrition_plans,
  meals, progress_entries, achievements, user_achievements`.
- **RLS auf allen Tabellen:** Nutzer sehen nur eigene Daten (`auth.uid() = user_id`);
  Referenzdaten (muscles/exercises/achievements/exercise_muscles) sind öffentlich lesbar (`using (true)`).
- Trigger **`handle_new_user`**: legt bei jeder Registrierung automatisch eine `profiles`-Zeile an.
- Seed-Daten: 9 Muskelgruppen, 5 Beispiel-Übungen, 3 Achievements.
- `profiles`-Felder: `first_name, birth_date, gender, height_cm, weight_kg, activity_level,
  allergies (text[]), experience_level, training_environment`.

## 7. App-Struktur & aktueller Stand
```
fitness-app/
├─ app/
│  ├─ App.tsx                 Routing: loading -> AuthScreen / OnboardingScreen / HomeScreen
│  ├─ lib/supabase.ts         Supabase-Client (AsyncStorage, persistSession, detectSessionInUrl:false)
│  ├─ contexts/AuthContext.tsx  session + profile (siehe Deadlock-Hinweis unten)
│  ├─ screens/AuthScreen.tsx    Login/Registrierung (dt. Fehlermeldungen)
│  ├─ screens/OnboardingScreen.tsx  5-Schritt-Onboarding
│  ├─ screens/HomeScreen.tsx    Begrüßung + Muskelliste + Logout
│  ├─ db/schema.sql, db/002_allergies.sql
│  └─ .env (gitignored), .env.example
├─ build/  Start-FitFusion-Web.cmd, Start-FitFusion.cmd, build-docx.ps1, content.json, setup-node.ps1
├─ FitFusion-Masterfile.docx   Produktvision/Konzept
├─ README.md, HANDOVER.md
```
**Logik-Details:**
- Routing in `App.tsx`: `loading` → kein `session` ⇒ AuthScreen → `session` aber `profile.experience_level == null` ⇒ OnboardingScreen → sonst HomeScreen.
- **AuthContext (Deadlock-Hinweis!):** Im `supabase.auth.onAuthStateChange`-Callback **niemals** `await`
  auf andere Supabase-Aufrufe – das führt zu einem Deadlock (App lädt endlos). Das Profil wird daher
  in einem **separaten `useEffect`** geladen.
- Onboarding speichert per **`upsert`** in `profiles` und **`insert`** in `goals`.
  Alter → näherungsweises `birth_date` (1. Januar). Allergien: 39 Optionen, Mehrfachauswahl.

## 8. Fertig (✅) / Offen (⬜)
**✅ Erledigt**
- Node + Expo-Projekt aufgesetzt, Web-Preview läuft im Browser
- Supabase-DB (15 Tabellen, RLS, Trigger, Seed)
- Registrierung / Login / Logout, Session bleibt erhalten
- 5-Schritt-Onboarding inkl. 39 Allergien → schreibt in `profiles` + `goals`
- Home-Screen (Begrüßung, Muskelliste)
- Auf GitHub gesichert

**⬜ Nächste Bausteine (Roadmap)**
1. **Kalorien-/Makrobedarf** aus Profil berechnen (BMR Mifflin-St Jeor → TDEE via Aktivitätsfaktor →
   Defizit/Überschuss je Ziel → Makros) und im Home-Screen anzeigen. *(Empfohlener nächster Schritt –
   nutzt vorhandene Daten, schnelles Erfolgserlebnis.)*
2. **Interaktive Muskelkarte + Übungen** je Muskel (Filter nach Level & Umgebung); Übungs-DB erweitern.
3. **Automatische Trainingspläne** (Splits).
4. **Ernährungsplan** (Mahlzeiten, Einkaufsliste) inkl. Allergie-/Vorlieben-Berücksichtigung.
5. **Fortschritts-Dashboard** (Gewichtsverlauf, Streaks; Tabellen `progress_entries`).
6. **Gamification** (XP/Badges; Tabellen `achievements`, `user_achievements` verdrahten).
7. **Premium-Funktionen** (KI-Coach etc., siehe Masterfile).
8. **Handy/Expo Go**: SDK-56-Mismatch mit der Store-Version von Expo Go **ungelöst** → Projekt-SDK an
   Store anpassen ODER Dev-Build (EAS). Bis dahin läuft die Entwicklung im **Browser**.

## 9. Befehle (Spickzettel)
- **Web starten:** `build\Start-FitFusion-Web.cmd` doppelklicken (oder in `app/`: PATH setzen + `npm run web`).
- **Typecheck:** in `app/` → `npx tsc --noEmit`
- **Speichern/Push:** `git add -A` → `git commit -m "..."` → `git push` (Zugangsdaten sind gespeichert).
- **DB ändern:** SQL schreiben → Nutzer führt es im Supabase **SQL Editor** aus.

## 10. Git / GitHub
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`.
- Commit-Identität: `Samuel <Samuelfb1907@users.noreply.github.com>`.
- Auth über **Personal Access Token** (im Windows-Anmeldeinformationsspeicher hinterlegt).
  Falls Push nach Token-Ablauf scheitert: neuen fine-grained PAT (Repo „FitFustion", Permission
  *Contents: Read and write*) erstellen und erneut pushen. Bei direkten Tool-Aufrufen
  `$env:GIT_TERMINAL_PROMPT='0'` setzen, damit nichts hängen bleibt.

## 11. Empfohlener nächster Schritt
**Kalorien- & Makrobedarf** aus den Onboarding-Daten berechnen und im Home-Screen anzeigen –
verwandelt die erfassten Profildaten in ein sichtbares, persönliches Ergebnis.
