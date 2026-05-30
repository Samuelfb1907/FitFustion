# FitFusion 🏋️‍♂️🥗

**Personalisierte Fitness- & Ernährungs-App** – verbindet Trainings- und Ernährungspläne
auf Basis deiner persönlichen Daten und Ziele.

> **Status:** Work in Progress (Lern-/Aufbauprojekt). Das Fundament steht: Login, Onboarding, Datenbank.

---

## ✨ Features

**Bereits umgesetzt**
- 🔐 Registrierung & Login (Supabase Auth, Session bleibt erhalten)
- 🧭 Geführtes Onboarding in 5 Schritten: persönliche Daten, **Allergien (39 Optionen)**, Trainingserfahrung, Trainingsumgebung, Ziel
- 🗄️ Profil & Ziele werden sicher gespeichert (Row Level Security: jeder sieht nur seine eigenen Daten)
- 🏠 Home-Screen mit Muskelgruppen aus der Datenbank

**Geplant**
- 🔥 Kalorien- & Makrobedarf aus dem Profil
- 💪 Interaktive Muskelkarte & Übungsdatenbank
- 📅 Automatische Trainingspläne
- 🍽️ Ernährungspläne & Einkaufsliste
- 📈 Fortschritts-Dashboard, Gamification, Premium-Funktionen

---

## 🛠️ Tech-Stack
- **Frontend:** React Native (Expo SDK 56) + TypeScript
- **Backend/Datenbank:** Supabase (PostgreSQL, Auth, Row Level Security)

---

## 📁 Projektstruktur
```
fitness-app/
├─ app/                       Expo-App (der eigentliche Code)
│  ├─ App.tsx                 Einstieg & Routing
│  ├─ lib/supabase.ts         Datenbank-Verbindung
│  ├─ contexts/               AuthContext (Login-Status)
│  ├─ screens/                Auth, Onboarding, Home
│  └─ db/                     SQL-Schema & Migrationen
├─ build/                     Hilfsskripte (Start, Tools)
├─ FitFusion-Masterfile.docx  Produktvision/Konzept
├─ HANDOVER.md                Detaillierter Projektstand
└─ README.md
```

---

## 🚀 Einrichtung (lokal)

**Voraussetzungen:** Node.js (LTS) und ein kostenloses Supabase-Konto.

1. **Repository klonen** und Abhängigkeiten installieren:
   ```bash
   git clone https://github.com/Samuelfb1907/FitFustion.git
   cd FitFustion/app
   npm install
   ```
2. **Umgebungsvariablen:** Kopiere `.env.example`, benenne die Kopie in `.env` um und trage deine
   Supabase-Werte ein (Supabase → *Project Settings → API Keys*):
   - `EXPO_PUBLIC_SUPABASE_URL` = Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `anon`/`public` bzw. Publishable Key
3. **Datenbank einrichten:** Im Supabase **SQL Editor** nacheinander ausführen:
   - `app/db/schema.sql`
   - `app/db/002_allergies.sql`
4. **(Dev-Tipp)** Supabase → *Authentication → Providers → Email* → „Confirm email" deaktivieren,
   damit Test-Logins ohne E-Mail-Bestätigung funktionieren.
5. **Starten:**
   - Im Browser: `npm run web`
   - Auf dem Handy: `npm start`, dann den QR-Code mit der App **Expo Go** scannen.

---

## 🔒 Hinweise
- `app/.env` enthält die Zugangsschlüssel und ist **nicht** im Repository (siehe `.gitignore`).
- Ausführlicher Projektstand, Architektur und nächste Schritte: siehe **[HANDOVER.md](HANDOVER.md)**.

---

## 📄 Status & Lizenz
Privates Lernprojekt – in aktiver Entwicklung. 🚧
