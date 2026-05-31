# FitFusion 🏋️‍♂️🥗

**Personalisierte Fitness- & Ernährungs-App** – verbindet Trainings- und Ernährungspläne
auf Basis deiner persönlichen Daten und Ziele. Läuft im **Browser** und auf dem **Handy** (Expo Go).

> **Status:** Work in Progress (Lern-/Aufbauprojekt). Fundament + Kernfunktionen für Training & Ernährung stehen.

---

## ✨ Features (umgesetzt)
- 🔐 **Registrierung & Login** (Supabase Auth, Session bleibt erhalten)
- 🧭 **Onboarding** in 5 Schritten: persönliche Daten, **39 Allergien**, Erfahrung, Umgebung, Ziel
- 🔥 **Täglicher Kalorien- & Makrobedarf** aus dem Profil (Mifflin-St-Jeor-Formel)
- 💪 **Training-Hub**: **Freies Training** mit **realistischem, klickbarem Körper** (männlich/weiblich je
  Geschlecht, Vorder-/Rückseite) → Übungen (nach Level & Equipment) → Detail · **+ automatischer Trainingsplan**
- 📝 **Training mitschreiben**: Sätze (Wiederholungen + Gewicht) + **„Training beenden"**
- 🍽️ **Essen-Hub**: **Kalorien-Tracker** (540+ Zutaten) **+ Ernährungsplan** (trifft Makros, allergikersicher)
- 📈 **Fortschritts-Dashboard**: Gewichtsverlauf, Wochenvolumen, persönliche Rekorde, Trainingshistorie
- 🎮 **Gamification**: Level/XP, Streak & Erfolge + **animierte Kalorien-Gauge**
- 🌙 **Dark Mode** & ⚙️ **Einstellungen** (Profil bearbeiten, Abmelden, Passwort-Reset)
- 🧭 Navigation über **5 Tabs**: **Start · Training · Essen · Fortschritt · Einstellungen**

## 🔭 Geplant
- 🎯 Tagesziele & Challenges · 🍳 eigene Rezepte/Mahlzeiten speichern
- 💎 Premium-Funktionen · 🎬 Übungs-Animationen · 📦 Standalone-App (Dev-Build via EAS)

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
│  ├─ components/                ExerciseDetail, CalorieGauge, Charts, Segmented, BodyMuscleMap
│  ├─ lib/                       supabase, nutrition, meals, gamification
│  ├─ screens/                   Auth, Onboarding, MainTabs, Home, Training-/Essen-Hub,
│  │                             Plan, Nutrition, FoodTracker, Progress, Settings, Profile
│  └─ db/                        schema.sql + Migrationen 002–007
├─ build/                        Hilfsskripte (Start, Tools)
├─ FitFusion-Masterfile.docx     Produktvision/Konzept
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
3. **Datenbank einrichten:** Im Supabase **SQL Editor** der Reihe nach ausführen:
   `app/db/schema.sql`, dann `002_allergies.sql`, `003_more_exercises.sql`,
   `004_more_exercises.sql`, `005_food_tracking.sql`, `006_foods_500plus.sql`, `007_session_end.sql`.
4. **(Dev-Tipp)** Supabase → *Authentication → Providers → Email* → „Confirm email" deaktivieren.
5. **Starten:**
   - **Browser:** `npm run web`
   - **Handy:** `npx expo start` → mit **Expo Go** den QR-Code scannen (App-SDK muss zur Expo-Go-Version passen)

## 🔒 Hinweise
- `app/.env` enthält die Zugangsschlüssel und ist **nicht** im Repository (siehe `.gitignore`).
- Ausführlicher Projektstand, Architektur & nächste Schritte: siehe **[HANDOVER.md](HANDOVER.md)**.

## 📄 Status & Lizenz
Privates Lernprojekt – in aktiver Entwicklung. 🚧
