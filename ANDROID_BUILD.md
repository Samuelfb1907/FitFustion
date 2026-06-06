# FitAvo – Android Closed Beta (EAS Build)

Ziel: eine **installierbare APK**, die du per **Link/QR** an beliebig viele Tester schickst –
kein Play Store, kein gemeinsames WLAN nötig. App-ID: `com.samuelfb1907.fitavo`.

---

## 1. Einmalig vorbereiten
1. Kostenloses **Expo-Konto** anlegen: https://expo.dev (Sign up).
2. **EAS CLI** installieren (Terminal/PowerShell):
   ```
   npm i -g eas-cli
   ```
3. **Einloggen:**
   ```
   eas login
   ```
4. **Projekt mit Expo verknüpfen** (legt automatisch die `projectId` in `app.json` an):
   ```
   cd C:\Users\Samuel\fitness-app\app
   eas init
   ```

## 2. Umgebungsvariablen in EAS hinterlegen  ⚠️ WICHTIG
Die App braucht beim Bauen `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Lokal stehen sie in `app/.env` – der **Cloud-Build kennt sie aber nicht**, darum in EAS eintragen.

**Einfachster Weg (Browser):** expo.dev → dein Projekt **FitAvo** → links **„Environment Variables"** → **„Create variable"**:

| Name | Wert | Sichtbarkeit | Environments |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://ugofjmdwjcrjvakilmsu.supabase.co` | Plain text | Preview (+ Production) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | *(Wert aus `app/.env` kopieren)* | Sensitive | Preview (+ Production) |
| `EXPO_PUBLIC_EXERCISEDB_KEY` *(optional)* | *(aus `app/.env`)* | Sensitive | Preview |

> Ohne den ExerciseDB-Key funktioniert alles – es werden dann statt animierter GIFs nur
> statische Muskelgrafiken gezeigt (kein Fehler). Für die Beta okay.

## 3. APK bauen
```
eas build -p android --profile preview
```
- Beim ersten Mal fragt EAS: **„Generate a new Android Keystore?"** → **Yes** (EAS verwaltet das automatisch).
- Dauer: ~10–20 Min (kostenloser Plan, evtl. kurze Warteschlange).
- Am Ende bekommst du eine **Seite mit QR-Code + Download-Link** der fertigen APK.

## 4. An Tester verteilen
- **Link oder QR** an die Leute schicken (egal, wo sie sind).
- Auf dem **Android-Handy** öffnen → **APK herunterladen** → **installieren**
  (einmalig **„Installation aus unbekannten Quellen erlauben"** bestätigen).
- App öffnen, registrieren, loslegen.
- 🎉 **Benachrichtigungen (Erinnerungen + tägliche Motivation) funktionieren hier** –
  anders als in Expo Go, weil es ein echter Build ist.

## 5. Neue Version verteilen
Code ändern → erneut `eas build -p android --profile preview` → neuen Link verschicken.
*(Tester installieren die neue APK einfach drüber.)*

## Voraussetzung in der DB
Die Tester nutzen dieselbe Supabase-Datenbank. Es sollten **alle Migrationen (002–017)**
ausgeführt sein, sonst fehlen Funktionen (z. B. Bestenliste = 017). E-Mail-Bestätigung ist aktiv,
neue Tester müssen also ihre E-Mail bestätigen.

## iPhone?
Geht nur über **TestFlight** + **Apple Developer Program (99 $/Jahr)**.
Sag Bescheid, dann richte ich `eas build -p ios` + die TestFlight-Abgabe ein.
