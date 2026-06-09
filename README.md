# FitAvo 🏋️‍♂️🥗

**Personalisierte Fitness- & Ernährungs-App** – verbindet Trainings- und Ernährungspläne
auf Basis deiner persönlichen Daten und Ziele. Läuft im **Browser** und auf dem **Handy** (Expo Go).

> **Status:** Work in Progress (Lern-/Aufbauprojekt). Fundament + Kernfunktionen für Training & Ernährung stehen.

---

## ✨ Features (umgesetzt)
- 🔐 **Registrierung & Login** (Supabase Auth) inkl. **Haftungsausschluss-Bestätigung** & „Passwort vergessen?"
- 🧭 **Onboarding** in 4 Schritten (persönliche Daten, Erfahrung, Umgebung, Ziel)
- 🔥 **Täglicher Kalorien- & Makrobedarf** aus dem Profil (Mifflin-St-Jeor)
- 💪 **Training-Hub**: Freies Training mit **realistischem, klickbarem Körper** (m/w) → Übungen (nach Level & Equipment) → Detail mit **animiertem GIF**, Anleitung, **Mitschreiben** & **Pausen-Timer** · **automatischer Trainingsplan** mit **Wochenkalender** & Tag-Bearbeiten
- 🍽️ **Essen-Hub**: **Kalorien-Tracker** (Mahlzeiten Frühstück/Mittag/Abend/Snack, **Schnellzugriff**), **Barcode-Scanner** (Open Food Facts), **eigene Lebensmittel** · **Wasser-Tracker**
- 📈 **Fortschritt**: Gewichtsverlauf, Wochenvolumen, persönliche Rekorde (+ geschätztes 1RM), **Übungs-Fortschritt**, Historie
- 🎮 **Gamification**: Level/XP, Streak, Erfolge · 🎯 **Tagesziele & Challenges**
- 🌙 **Dark Mode** · ⚙️ **Einstellungen** (Profil, Erinnerungen, **Datenschutz: Datenexport & Konto löschen**, Rechtliches)
- 🧭 Navigation über **5 Tabs**: **Start · Training · Essen · Fortschritt · Einstellungen**

## 🔭 Geplant / offen
- 💎 Premium-Funktionen · 📦 Standalone-App (Dev-Build via EAS) · 🔔 echte Erinnerungen (nur im Dev-Build)
- 🔑 ExerciseDB-Key serverseitig (Proxy) · ✉️ E-Mail-Bestätigung aktivieren · 📜 Impressum + Datenschutz-Platzhalter ausfüllen (vor Release)

---

## 🛠️ Tech-Stack
- **Frontend:** React Native (**Expo SDK 54**) + TypeScript
- **Backend/Datenbank:** Supabase (PostgreSQL, Auth, Row Level Security)
- **UI/Grafik:** `react-native-svg`, `react-native-body-highlighter` (Muskel-Körper)

> ℹ️ **Warum SDK 54?** Die App ist auf die SDK-Version abgestimmt, die die installierte **Expo-Go**-App
> unterstützt. Beim Testen am Handy müssen **App-SDK und Expo-Go-Version zusammenpassen** – sonst meldet
> Expo Go „incompatible". Für ein neueres SDK ohne diese Bindung: **Dev-Build via EAS**.

## 📁 Projektstruktur
```
fitness-app/
├─ app/                          Expo-App
│  ├─ App.tsx                    Routing (Auth / Onboarding / MainTabs)
│  ├─ contexts/                  AuthContext (Session+Profil), ThemeContext (Dark Mode)
│  ├─ components/                ExerciseDetail, ExerciseGif, ExerciseFigure, RestTimer,
│  │                             BarcodeScanner, BodyMuscleMap, Charts, CalorieGauge, Segmented, LegalText
│  ├─ lib/                       supabase, nutrition, meals, gamification, goals, weight, date,
│  │                             weekdays, reminders, openFoodFacts, barcodeFood, exerciseMedia, gdpr, legal, useFocusTick
│  ├─ screens/                   Auth, Onboarding, MainTabs, Home, Training-/Essen-Hub,
│  │                             Plan, FoodTracker, Water, Progress, Settings, Profile
│  └─ db/                        schema.sql + Migrationen 002–027
├─ supabase/functions/           Edge Function delete-account (DSGVO, optional)
├─ AUDIT.md · RECHTLICHES.md · SUPABASE_FUNCTIONS.md   Audit/To-dos, Rechtstexte, Function-Doku
├─ HANDOVER.md                   Detaillierter Projektstand
└─ README.md
```

## 🚀 Einrichtung (lokal)
**Voraussetzungen:** Node.js (LTS) und ein kostenloses Supabase-Konto.

1. **Repository klonen** und Abhängigkeiten installieren:
   ```bash
   git clone https://github.com/Samuelfb1907/FitFustion.git
   cd FitFustion/app
   npm install
   ```
2. **Umgebungsvariablen:** `.env` in `app/` anlegen (Supabase → *Project Settings → API Keys*):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_EXERCISEDB_PROXY` *(optional, `=1`)* – animierte Übungs-GIFs über die serverseitige Edge Function `exercisedb-image` (der bezahlte RapidAPI-Key bleibt **serverseitig**, siehe `SUPABASE_FUNCTIONS.md`). Ohne den Proxy zeigt die App statt GIFs statische Muskelgrafiken. Den RapidAPI-Key **nicht** in den Client legen.
3. **Datenbank einrichten:** Im Supabase **SQL Editor** **in dieser Reihenfolge** ausführen:
   `schema.sql` → `002_allergies.sql` → `003_more_exercises.sql` → `004_more_exercises.sql` →
   `005_food_tracking.sql` → `006_foods_500plus.sql` → `007_session_end.sql` → `008_more_exercises_gifs.sql` →
   `009_water.sql` → `010_recipes.sql` → `011_barcode.sql` → `012_meal_types.sql` →
   `013_plan_schedule.sql` → `014_gdpr.sql` → `015_privacy_indexes.sql` → `016_integrity.sql` → `017_leaderboard.sql`.
   *(Alle idempotent. 008 ist optional – nur zusätzliche Übungs-Seeds. 010 legt ungenutzte recipes-Tabellen an, schadet aber nicht. 016 macht das FK-Löschverhalten explizit + Integritäts-Indizes. 017 legt die Bestenliste `leaderboard_entries` an.)*
4. **E-Mail-Bestätigung:** Für die Entwicklung kann unter Supabase → *Authentication → Email* „Confirm email" aus bleiben. **Für eine Veröffentlichung unbedingt aktivieren.**
5. **Starten:**
   - **Browser:** `npm run web`
   - **Handy:** `npx expo start` → mit **Expo Go** den QR-Code scannen (App-SDK muss zur Expo-Go-Version passen)

## 🔒 Hinweise
- `app/.env` enthält die Zugangsschlüssel und ist **nicht** im Repository (siehe `.gitignore`).
- Ausführlicher Projektstand, Architektur & nächste Schritte: siehe **[HANDOVER.md](HANDOVER.md)**.

## 📄 Status & Lizenz
Privates Lernprojekt – in aktiver Entwicklung. 🚧
