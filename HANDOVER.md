# HANDOVER – FitFusion (Projekt-Übergabe für Claude)

> **Zweck:** Kompletter Projektstand, damit eine **neue Claude-Session ohne Vorwissen** sofort
> weiterarbeiten kann. Im neuen Chat einfügen oder darauf verweisen.
>
> *Stand: Auth, Onboarding, 5-Tab-App mit Training-/Essen-Hub, realistischer klickbarer Körper,
> Fortschritts-Dashboard, Dark Mode, Gamification, **animierte Übungs-GIFs (ExerciseDB)** und
> **127 Übungen** (≥5 je Muskel & Umgebung). Läuft im Browser UND auf dem Handy (Expo Go, SDK 54).*

---

## 0. Aktueller Stand & Wiedereinstieg
- **Zuletzt gebaut:** **Animierte Übungs-GIFs** + **viel mehr Übungen**.
  - Jede Übung im Detail zeigt oben eine **animierte 3D-GIF-Demo** (ExerciseDB). Fallback ohne
    GIF/Internet: statische Muskel-Grafik (`ExerciseFigure`).
  - **127 Übungen** gesamt (68 alt + **59 neu** via Migration 008): **≥5 pro Muskel je Umgebung**
    (Kein Equipment / Home-Gym / Studio) und **≥5 Anfänger pro Muskel** (gesamt). Anfänger-
    Körpergewicht erreicht 5 bei 7/9 Muskeln; **Bizeps & Schultern nur 3** (mit reinem Körpergewicht
    real nicht mehr möglich – mit Kurzhantel/höherem Level aber ≥5).
  - **Profil** (`ProfileScreen`) kann jetzt **Erfahrungslevel** und **Trainingsumgebung** ändern.
- **⚠️ OFFENER DB-SCHRITT:** **Migration `008_more_exercises_gifs.sql` muss im Supabase SQL Editor
  ausgeführt sein** (fügt die 59 neuen Übungen ein, idempotent). Schnell-Check: zeigt das Training pro
  Muskel viele Übungen? Wenn nein → 008 ausführen (SQL per `Set-Clipboard` liefern).
- **⚠️ ExerciseDB-API-Key (kostenpflichtiger Plan!):** liegt in **`app/.env`** als
  `EXPO_PUBLIC_EXERCISEDB_KEY` (NICHT im Repo). Der Nutzer hat einen **bezahlten RapidAPI-Plan**
  (sonst kommen keine GIFs, nur Text). Details s. Abschnitt 6b.
- **Am Handy:** `npx expo start` in `app/` → QR mit Expo Go scannen (SDK muss 54 bleiben, s. Abschnitt 4).
- **Browser:** `build\Start-FitFusion-Web.cmd` oder `npx expo start --web`.
- **Build:** `npx tsc --noEmit` lief fehlerfrei.
- **Nächster Schritt:** offen – mit Nutzer abstimmen (Roadmap Abschnitt 8). Nutzer wollte ggf. noch
  „speichern" auf GitHub und Theraband-Anfängervarianten für Bizeps/Schultern.

---

## 1. Projekt in einem Satz
**FitFusion** – mobile Fitness- & Ernährungs-App (Expo/React Native + Supabase). Produktvision: `FitFusion-Masterfile.docx`.

## 2. Arbeitsweise mit dem Nutzer (wichtig)
- Nutzer ist **Programmier-Anfänger**. Modus: **„Claude richtet ein, erklärt jeden Schritt"**.
- **Sprache: Deutsch**, klar & schrittweise. Ablauf: bauen → `npx tsc --noEmit` → testen lassen → committen.
- Bei Design/Features hat der Nutzer einen **hohen Qualitätsanspruch** (lieber ehrlich Grenzen nennen
  als schlechte Platzhalter liefern – z. B. Animationen: selbstgezeichnet wurde abgelehnt).

## 3. Umgebung (Windows) – Stolpersteine
- OS Windows, **PowerShell 5.1**. Arbeitsverzeichnis: `C:\Users\Samuel\fitness-app`.
- **Node v24 PORTABEL** unter `C:\Users\Samuel\tools\node` (nicht im PATH): vorher
  `$env:Path = 'C:\Users\Samuel\tools\node;' + $env:Path`.
- **PS 5.1 zeigt UTF-8-Dateien als ANSI falsch an** (Umlaute „Ã¤"). Zum Prüfen **Read-Tool** oder
  `Get-Content -Encoding UTF8`. Inline-PS-Befehle ASCII halten.
- **git commit:** Mehrzeilige Nachrichten + Sonderzeichen scheitern oft am PS-Quoting →
  Nachricht in Tempdatei schreiben und `git commit -F <datei>`. `$env:GIT_TERMINAL_PROMPT='0'`.
- DB-Änderungen: SQL liefern, **Nutzer führt sie im Supabase SQL Editor aus** (per `Set-Clipboard`).
- **`.env`-Änderung → Metro neu starten** (`npx expo start -c`), sonst greift die neue Variable nicht.

## 4. Tech-Stack
| Bereich | Wahl |
|---|---|
| Frontend | **Expo SDK 54**, React Native 0.81.5, React 19.1.0, TypeScript 5.9 |
| Backend/DB | Supabase (PostgreSQL, Auth, RLS) |
| Libs | `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `react-native-svg`, `react-native-body-highlighter` |
| Web-Preview | `react-dom`, `react-native-web`, `@expo/metro-runtime` |
| Repo | GitHub `Samuelfb1907/FitFustion`, Branch `main` |
- **SDK 54 ist FIX** (Expo Go des Nutzers unterstützt nur 54). NICHT upgraden, sonst „incompatible".
  Versionen mit `npx expo install ...` / `npx expo install --fix` setzen.

## 5. Supabase
- Projekt-Ref `ugofjmdwjcrjvakilmsu` · URL `https://ugofjmdwjcrjvakilmsu.supabase.co`
- Dashboard: `https://supabase.com/dashboard/project/ugofjmdwjcrjvakilmsu`
- `app/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_EXERCISEDB_KEY` (alle gitignored).
- E-Mail-Bestätigung deaktiviert. DB-Passwort/service_role NIE teilen.

## 6. Datenbank + Migrationen
- Reihenfolge im SQL Editor: `schema.sql` → `002_allergies` → `003_more_exercises` →
  `004_more_exercises` → `005_food_tracking` → `006_foods_500plus` → `007_session_end`
  (`workout_sessions.ended_at`) → **`008_more_exercises_gifs`** (59 neue Übungen). Alle idempotent.
- 17 Tabellen (profiles, goals, muscles, exercises, …, foods, food_logs). RLS überall.
- `exercises`: name, difficulty (beginner/intermediate/advanced), equipment
  (barbell/dumbbell/machine/cable/bodyweight/none/other), primary_muscle_id, description, instructions.
- Muskel-Keys: chest, back, shoulders, biceps, triceps, abs, legs, calves, glutes.

### 6b. Übungs-GIFs (ExerciseDB) – WICHTIG
- Quelle: **ExerciseDB über RapidAPI**, Host `exercisedb.p.rapidapi.com`. Key in `app/.env`
  (`EXPO_PUBLIC_EXERCISEDB_KEY`). **Bezahlter Plan nötig** (Gratis = nur Textdaten, keine Bilder).
- **Diese API liefert KEIN `gifUrl`-Feld.** GIF nur über den **Bild-Endpunkt**:
  `GET https://exercisedb.p.rapidapi.com/image?exerciseId={ID}&resolution=360`
  mit Headern `X-RapidAPI-Key` + `X-RapidAPI-Host`. **GET (nicht HEAD!)**, Header zwingend.
  (HEAD gibt 404 – das hatte uns lange in die Irre geführt.) Auflösung 360 (Plan-abhängig).
- **`app/lib/exerciseMedia.ts`**: `EXERCISE_GIF_ID` = Map *deutscher Übungsname → ExerciseDB-ID*
  (127 Einträge) + `exerciseGifId(name)`. **Auto-generiert** per Node-Skript (s. u.).
- **`app/components/ExerciseGif.tsx`**: lädt das GIF via `<Image source={{uri, headers}}>`
  (RN cached per uri → ~1 Request je Übung). Bei Fehler → `onFail` → Fallback `ExerciseFigure`.
- Generator-Skripte liegen in **`%TEMP%`** (nicht im Repo): `gen-final.js` erzeugt
  `exerciseMedia.ts` + `008_*.sql`; `%TEMP%\exercisedb-list.json` = komplette ExerciseDB-Liste
  (mit `npx ... /exercises?limit=1500` + Key geholt). **Neue Übungen hinzufügen:** Eintrag in der
  `ADDED`-Liste von `gen-final.js` ergänzen (deutscher Name + keywords ODER feste `id` + muscle +
  equipment + difficulty + desc + instr) → `node gen-final.js` → schreibt beide Dateien + prüft
  „≥5 je Umgebung". Matching gegen ExerciseDB-Namen (englisch) per Stichworten.
- **Publishing-Hinweis:** Key steckt aktuell client-seitig (ok für Tests). Vor echtem Release über
  einen Server-Proxy (z. B. Supabase Edge Function) verstecken.

## 7. App-Struktur (aktuell)
```
app/
  App.tsx                       Routing (loading -> Auth / Onboarding / MainTabs), Theme+Auth Provider
  contexts/AuthContext.tsx      session + profile {id, first_name, gender, experience_level, training_environment}
                                (Deadlock-Hinweis: im onAuthStateChange NIE await auf DB!)
  contexts/ThemeContext.tsx     Dark/Light (useColors/useTheme); Tokens inkl. accent/hero/muscle
  components/BodyMuscleMap.tsx   realistischer, klickbarer Koerper (react-native-body-highlighter),
                                 Vorder-/Rueckseite, gender m/w, Muskel dezent getoent
  components/ExerciseGif.tsx     animiertes ExerciseDB-GIF (Image + Header), onFail-Fallback
  components/ExerciseFigure.tsx  statische anatomische Koerpergrafik (Zielmuskel hervorgehoben) = Fallback
  components/CalorieGauge.tsx    animierte Halbkreis-Gauge (svg)
  components/Charts.tsx          LineChart + BarChart (svg) fuer Fortschritt
  components/Segmented.tsx       Pillen-Umschalter (Hubs)
  components/ExerciseDetail.tsx  Detail: GIF/Fallback + Beschreibung + nummerierte Schritte + Tipps + "Training mitschreiben" + "Training beenden"
  lib/supabase.ts | nutrition.ts | meals.ts | gamification.ts
  lib/exerciseMedia.ts          Name -> ExerciseDB-ID (auto-generiert)
  screens/AuthScreen | OnboardingScreen (5 Schritte)
  screens/MainTabs.tsx          5 Reiter: Start | Training | Essen | Fortschritt | Einstellungen (iOS paddingBottom 30)
  screens/HomeScreen.tsx        Hero (Level/Streak/XP), "Training laeuft"-Banner+Beenden, Kalorien-Gauge, Schnellzugriff, Erfolge
  screens/TrainingScreen.tsx    HUB: Freies Training (BodyMuscleMap -> Uebungen -> ExerciseDetail) | Plan (PlanScreen embedded)
  screens/PlanScreen.tsx        Auto-Trainingsplan (embedded-faehig)
  screens/EssenScreen.tsx       HUB: Tracker | Ernaehrungsplan (beide embedded)
  screens/NutritionScreen.tsx | FoodTrackerScreen.tsx  (embedded-faehig)
  screens/ProgressScreen.tsx    Gewichtsverlauf (Eingabe), Wochenvolumen, Rekorde, Historie
  screens/SettingsScreen.tsx    Einstellungen + Dark-Mode + Profil-Unterseite
  screens/ProfileScreen.tsx     Profil: Name/Alter/Geschlecht/Gewicht/Groesse/Aktivitaet/**Erfahrungslevel**/**Trainingsumgebung**/Ziel
  db/*.sql                      schema + 002..008
```
**Filter-Logik (Training/Plan):** `ALLOWED_DIFF[experience_level]` (beginner/some/advanced/pro) und
`ALLOWED_EQUIP[training_environment]`: gym = alle; home_gym = dumbbell/bodyweight/none/other;
no_equipment = bodyweight/none. → Übungen werden nach Level **und** Umgebung gefiltert.
**Body-Map gender:** `profile.gender === 'female' ? 'female' : 'male'`.

## 8. Roadmap (offen)
1. Theraband-/Wasserflaschen-Anfängervarianten für **Bizeps & Schultern** (Kein-Equipment).
2. Tagesziele & Challenges; eigene Rezepte/Mahlzeiten speichern.
3. API-Key per Server-Proxy verstecken (vor Veröffentlichung).
4. Premium-Funktionen; neuere SDKs via EAS Dev-Build (dann nicht mehr an Expo-Go-SDK gebunden).

## 9. Befehle (Spickzettel)
- Node-PATH setzen (s. Abschnitt 3).
- Handy: in `app/` → `npx expo start` (nach Versions-/`.env`-Wechsel `-c`). LAN-IP via
  `Get-NetIPConfiguration`. exp-URL = `exp://<IP>:8081`. QR via api.qrserver.com -> `build/expo-qr.png` (gitignored) -> mit Read anzeigen.
- Browser: `build\Start-FitFusion-Web.cmd`.
- Typecheck: in `app/` → `npx tsc --noEmit`.
- ExerciseDB testen: `Invoke-WebRequest 'https://exercisedb.p.rapidapi.com/image?exerciseId=0001&resolution=360' -Headers @{'X-RapidAPI-Key'=$key;'X-RapidAPI-Host'='exercisedb.p.rapidapi.com'}` (GET!).
- Speichern: Commit-Nachricht in Tempdatei → `git add -A; git commit -F <datei>; git push`.

## 10. Git / GitHub
- Remote `origin` = `https://github.com/Samuelfb1907/FitFustion.git`, Branch `main`.
- Commit-Identität: `Samuel <Samuelfb1907@users.noreply.github.com>`.
- Commit-Messages enden mit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Auth via PAT (Windows-Anmeldespeicher).

## 11. Empfohlener nächster Schritt
Mit Nutzer abstimmen. Sicherstellen, dass **Migration 008 ausgeführt** ist; dann ggf. Theraband-
Anfängervarianten (Bizeps/Schultern) oder Tagesziele/Challenges.
