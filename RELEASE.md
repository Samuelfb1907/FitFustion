# FitAvo – Release-Anleitung (Android zuerst, Apple optional)

Ziel: aus dem Code einen echten Store-Build machen und veröffentlichen.
Reihenfolge von oben nach unten abarbeiten. Befehle laufen im Ordner `app/`.

> Voraussetzung: Du bist bei EAS eingeloggt (hast du beim ersten Build schon gemacht).
> Falls nicht: `npx eas-cli login`

---

## 0. Was DU noch selbst machst
- **App-Icon** (übernimmst du): `app/assets/icon.png` (1024×1024, ohne Transparenz) ersetzen.
  Für Android zusätzlich die adaptiven Icons in `app/assets/` (foreground/background/monochrome).
  Danach in `app.json` ggf. `android.adaptiveIcon.backgroundColor` an dein Logo anpassen
  (steht aktuell auf `#E6F4FE`).

## 1. Erledigt (von mir)
- ✅ Unnötige Mikrofon-Berechtigung entfernt (`RECORD_AUDIO` geblockt; nur Kamera bleibt).
- ✅ Bundle-IDs gesetzt: `com.samuelfb1907.fitavo` (iOS & Android).
- ✅ EAS-Build-Profile vorhanden (`preview` = APK zum Testen, `production` = AAB für Play).

## 2. WICHTIG: Umgebungsvariablen für „production" prüfen
Der Produktions-Build nutzt die **production**-Umgebung. Dort müssen die gleichen
Variablen gesetzt sein wie bei „preview", sonst startet die App ohne Datenbank.

EAS-Dashboard → dein Projekt → **Environment Variables** → Environment **Production**:
- `EXPO_PUBLIC_SUPABASE_URL`  = (deine Supabase-URL)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (dein anon key)
- `EXPO_PUBLIC_EXERCISEDB_PROXY` = `1`

(Alternativ pro Variable „Production" als Environment mit anhaken.)

## 3. Edge Functions deployed?
Im Supabase-Dashboard → Edge Functions müssen aktiv sein:
- `delete-account` (Konto-Löschung)
- `exercisedb-image` (Übungs-GIF-Proxy)
Falls nicht: im Dashboard deployen.

## 4. Auf echtem Gerät testen (Pflicht vor Release!)
Expo Go reicht NICHT – ein echter Build verhält sich teils anders.

**Android-Testbuild (installierbare APK):**
```
cd C:\Users\Samuel\fitness-app\app
npx eas-cli build -p android --profile preview
```
→ Link öffnen, APK aufs Handy laden, installieren.

**Durchtesten:** Login/Registrierung, Onboarding (Geburtsdatum), Plan erstellen,
Training starten+beenden → Trainingsbonus, Essen tracken + Barcode scannen,
Wasser, Fortschritt/Chart, Bestenliste beitreten/verlassen, Konto löschen,
Dark Mode, Flugmodus → Offline-Banner.

## 5. Produktions-Build (AAB für Google Play)
```
cd C:\Users\Samuel\fitness-app\app
npx eas-cli build -p android --profile production
```
→ erzeugt eine **.aab** (App Bundle) für den Play-Upload. (AAB lässt sich NICHT
direkt aufs Handy installieren – dafür ist der preview-APK-Build aus Schritt 4.)

## 6. Google Play Console
1. **Entwicklerkonto** anlegen (einmalig **25 $**): play.google.com/console
2. **App erstellen** → Name „FitAvo", Sprache Deutsch, App (kein Spiel), kostenlos.
3. **Store-Eintrag**: Kurz-/Langbeschreibung, **Screenshots** (Handy), Grafik-Icon (512×512),
   Feature-Grafik (1024×500), Kategorie „Gesundheit & Fitness".
4. **Datenschutzerklärung-URL** (Pflicht!) → kommt aus deinem Datenschutz-Text
   (z. B. als öffentliche Seite/GitHub-Page hosten).
5. **Data safety / Datensicherheit**-Formular ausfüllen:
   - Erhobene Daten: Konto (E-Mail), Gesundheit & Fitness (Gewicht, Training, Ernährung)
   - Daten verschlüsselt übertragen: ja
   - Nutzer kann Löschung beantragen: ja (In-App + delete-account)
6. **Inhaltsbewertung** (Fragebogen) ausfüllen.
7. **Release → Testen → Interner Test**: AAB hochladen, dich selbst als Tester
   hinzufügen, erst intern testen, dann „Produktion".

Optional automatisch hochladen statt manuell: `npx eas-cli submit -p android`

## 7. Apple App Store (nur falls iOS gewünscht)
- Apple Developer Program (**99 $/Jahr**).
- App Store Connect → neue App, Bundle `com.samuelfb1907.fitavo`.
- Build: `npx eas-cli build -p ios --profile production` (braucht Apple-Login).
- **Privacy Nutrition Labels** ausfüllen (wie Data Safety).
- **Konto-Löschung** ist Pflicht (haben wir ✅).
- Über **TestFlight** testen, dann zur Prüfung einreichen.

## 8. DSGVO (vor Veröffentlichung)
- **Impressum + Datenschutzerklärung** mit echten Angaben (noch offen).
- **AVV (Auftragsverarbeitung) mit Supabase** abschließen; EU-Region prüfen.
- Datenschutz-Text auch als **öffentliche URL** bereitstellen (für die Stores).

---

### Kurz-Reihenfolge
Icon (du) → Env-Vars prüfen → Testbuild (APK) → durchtesten → Prod-Build (AAB) →
Play-Konto + Eintrag + Datenschutz-URL + Data-Safety → interner Test → Produktion.
