# FitFusion 🏋️‍♂️🥗

**Personalisierte Fitness- & Ernährungs-App** – verbindet Trainings- und Ernährungspläne
auf Basis deiner persönlichen Daten und Ziele.

> **Status:** Work in Progress (Lern-/Aufbauprojekt). Fundament + Kernfunktionen für Training & Ernährung stehen.

---

## ✨ Features (umgesetzt)
- 🔐 **Registrierung & Login** (Supabase Auth, Session bleibt erhalten)
- 🧭 **Onboarding** in 5 Schritten: persönliche Daten, **39 Allergien**, Erfahrung, Umgebung, Ziel
- 🔥 **Täglicher Kalorien- & Makrobedarf** aus dem Profil (Mifflin-St-Jeor-Formel)
- 💪 **Trainingsbereich**: Muskelgruppe → ~68 Übungen, **gefiltert nach Level & Equipment** → Details
- 📝 **Training mitschreiben**: Sätze (Wiederholungen + Gewicht) pro Übung
- 🤖 **Automatischer Trainingsplan**: Split passend zu deinen Trainingstagen
- 🍽️ **Ernährungsplan**: Mahlzeiten, die deine Makros treffen – **allergikersicher**
- 🍎 **Kalorien-Tracker** mit **540+ Zutaten** (eigene Mengen, Tagessumme vs. Ziel)
- 🎮 **Gamification-Dashboard**: Level/XP, Streak & Erfolge + **animierte Kalorien-Gauge** (gegessen vs. übrig)
- 🌙 **Dark Mode** (hell/dunkel, gespeichert) & ⚙️ **Einstellungen** (Profil bearbeiten, Abmelden, Passwort-Reset)
- 🧭 Navigation über 6 Tabs: **Start · Training · Plan · Ernährung · Tracker · Einstellungen**

## 🔭 Geplant
- 📈 Fortschritts-Dashboard (Trainingshistorie, Rekorde, Gewichtsverlauf)
- 💎 Premium-Funktionen · 🎯 Tagesziele & Challenges
- 🧍 Visuelle 3D-Muskelkarte & Übungs-Animationen · 📱 native Handy-Builds

---

## 🛠️ Tech-Stack
- **Frontend:** React Native (Expo SDK 56) + TypeScript
- **Backend/Datenbank:** Supabase (PostgreSQL, Auth, Row Level Security)

## 📁 Projektstruktur
```
fitness-app/
├─ app/                          Expo-App
│  ├─ App.tsx                    Routing (Auth / Onboarding / MainTabs)
│  ├─ contexts/AuthContext.tsx   Login-Status + Profil
│  ├─ components/ExerciseDetail.tsx
│  ├─ lib/                       supabase.ts, nutrition.ts, meals.ts
│  ├─ screens/                   Auth, Onboarding, MainTabs, Home,
│  │                             Training, Plan, Nutrition, FoodTracker
│  └─ db/                        schema.sql + Migrationen 002–006
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
2. **Umgebungsvariablen:** `.env.example` zu `.env` kopieren und Supabase-Werte eintragen
   (Supabase → *Project Settings → API Keys*):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. **Datenbank einrichten:** Im Supabase **SQL Editor** der Reihe nach ausführen:
   `app/db/schema.sql`, dann `002_allergies.sql`, `003_more_exercises.sql`,
   `004_more_exercises.sql`, `005_food_tracking.sql`, `006_foods_500plus.sql`.
4. **(Dev-Tipp)** Supabase → *Authentication → Providers → Email* → „Confirm email" deaktivieren.
5. **Starten:** Browser `npm run web` · Handy `npm start` (QR-Code mit **Expo Go** scannen).

## 🔒 Hinweise
- `app/.env` enthält die Zugangsschlüssel und ist **nicht** im Repository (siehe `.gitignore`).
- Ausführlicher Projektstand, Architektur & nächste Schritte: siehe **[HANDOVER.md](HANDOVER.md)**.

## 📄 Status & Lizenz
Privates Lernprojekt – in aktiver Entwicklung. 🚧
