# FitAvo – App Store Connect Checkliste (zum Abtippen)

Stand: 2026-06-11. Diese Datei bündelt, was du im **App Store Connect** und auf **fitavo.eu**
eintragen musst. Bezieht sich auf den echten Code (was die App wirklich erhebt/sendet).

---

## 1) App Privacy ("Nutrition Labels")  →  App Store Connect → App-Datenschutz

**Tracking:** NEIN. Die App nutzt **kein** Tracking über Apps/Websites hinweg, kein Werbe-ID/IDFA.
→ Antworte: *"Daten werden NICHT verwendet, um dich zu tracken."*

**Erhobene Daten (alle mit dem Konto VERKNÜPFT, NICHT zum Tracking):**

| Apple-Kategorie | Konkret in FitAvo | Zweck |
|---|---|---|
| Kontaktdaten | E-Mail-Adresse | Konto-Anmeldung |
| Gesundheit & Fitness | Gewicht, Größe, Trainings/Sätze, Kalorien & Nährwerte, (optional) Schritte/aktive Kalorien aus Health Connect* | App-Funktion (Tracking, Auswertung) |
| Sensible Daten | Geschlecht, Geburtsdatum | Kalorienbedarf/Alter, App-Funktion |
| Nutzerinhalte | Mahlzeiten-Freitext (bei KI-Erkennung) | Wird zur Analyse an Anthropic (USA) gesendet |
| Bezeichner | Nutzer-ID (Konto) | Kontozuordnung |
| Käufe | Abo-/Kaufstatus | Premium-Freischaltung (über Apple/RevenueCat) |

*Health Connect ist **Android-only**; auf iOS wird **keine** Apple-Health-Berechtigung verlangt.

**Foto/Kamera:** Die Kamera wird **nur** zum Barcode-Scannen benutzt – es werden **keine Fotos** gespeichert oder hochgeladen.

**Drittanbieter / Auftragsverarbeiter (für die Datenschutz-Angaben):**
- **Supabase** – Konto, Datenbank, Speicherung
- **Anthropic (USA)** – KI-Mahlzeitenerkennung (nur der eingegebene Text)
- **RevenueCat (USA)** – Abo-Verwaltung (pseudonyme Nutzer-ID + Kaufstatus)
- **Open Food Facts** – Barcode-Abfrage (es wird nur der Barcode gesendet)
- **ExerciseDB (über eigenen Proxy)** – Übungs-GIFs (keine personenbezogenen Daten)

---

## 2) Pflicht-Angaben & Einstellungen in App Store Connect

- [ ] **EU-DSA-Händlerstatus ("Trader Status")** ausfüllen (Pflicht bei In-App-Käufen in der EU – sonst Entfernung aus EU-Stores).
- [ ] **Datenschutz-URL:** https://www.fitavo.eu/datenschutzerklaerung/
- [ ] **EULA/Nutzungsbedingungen-URL:** https://www.fitavo.eu/nutzungsbedingungen/ (im Abo-Bereich verlinken)
- [ ] **Support-URL:** https://www.fitavo.eu/support/  (Seite anlegen – Text siehe unten)
- [ ] **Marketing-URL** (optional): https://www.fitavo.eu/
- [ ] **Altersfreigabe:** Fragebogen ehrlich ausfüllen (Gesundheits-/Fitness-Inhalte). Voraussichtlich 4+ bis 12+.
- [ ] **Abo (auto-renewable)** in App Store Connect anlegen: 9,99 €/Monat, Produkt-ID z. B. `fitavo_premium_monthly`, mit lokalisierter Beschreibung + Anzeigename. Danach in RevenueCat verknüpfen.
- [ ] **iPad:** `supportsTablet:true` ist gesetzt → entweder iPad-Screenshots + iPad-Layout liefern, ODER in `app.json` auf `false` setzen (Entscheidung von dir).
- [ ] **Demo-Account** für die Prüfung hinterlegen (siehe Review-Notizen).

---

## 3) Review-Notizen (App Review Information → Notes)  – Vorlage

```
Sprache der App: Deutsch.

Anmeldung: E-Mail + Passwort (KEIN Social-Login, daher kein "Sign in with Apple").

Demo-Konto (Premium aktiv):
  E-Mail:   review@fitavo.eu        <-- bitte echtes Test-Konto eintragen
  Passwort: ********                <-- bitte eintragen

Premium-Funktionen: Über das Demo-Konto sind alle Premium-Funktionen freigeschaltet
(KI-Mahlzeitenerkennung, Barcode-Scanner, Bestenliste, alle Übungen, Level, Trainingspläne).
Die Paywall erscheint, wenn ein Gratis-Nutzer eine gesperrte Funktion (Schloss-Symbol) antippt.

In-App-Kauf testen: Das Monats-Abo (9,99 €/Monat) ist als auto-renewable Subscription angelegt
und kann im Sandbox-Modus gekauft werden. "Käufe wiederherstellen" ist in der Paywall verfügbar.

Hinweis: Health Connect wird nur auf Android genutzt; auf iOS werden keine Gesundheitsberechtigungen abgefragt.
```

> ⚠️ Vor dem Review-Build: **`test_`-RevenueCat-Schlüssel gegen den echten `appl_`-Schlüssel tauschen**
> (sonst funktionieren echte Käufe nicht). Test-Schalter wurde bereits entfernt.

---

## 4) Support-Seite (Text für fitavo.eu/support)

```
FitAvo – Support & Hilfe

Du brauchst Hilfe oder hast Feedback? Schreib uns einfach:
E-Mail: Info@fitavo.eu  (Antwort i. d. R. innerhalb weniger Werktage)

Häufige Fragen:
• Abo kündigen: iPhone → Einstellungen → [dein Name] → Abonnements → FitAvo → Kündigen.
• Passwort vergessen: Im Login auf „Passwort vergessen?" – du bekommst einen 6-stelligen Code per E-Mail.
• Konto & Daten löschen: In der App unter Einstellungen → Datenschutz → „Konto & alle Daten löschen".
• Daten exportieren: Einstellungen → Datenschutz → „Meine Daten exportieren".

Anbieter: Samuel Sinemli · Wilhelmsthaler Straße 2 · 34379 Calden · Info@fitavo.eu
```

---

## 5) ASO – Deutsche Keywords & Texte (Entwurf)

**Untertitel (max. 30 Zeichen):**
`Training & Kalorien tracken`

**Werbetext / Promotional Text (max. 170 Zeichen):**
`Trainiere mit Körper-Karte & GIFs, tracke Kalorien per KI und Barcode, sieh deinen Fortschritt – komplett auf Deutsch und DSGVO-konform. 🥑`

**Keywords (max. 100 Zeichen, kommagetrennt, ohne Leerzeichen-Verschwendung):**
`fitness,krafttraining,muskelaufbau,kalorien,abnehmen,ernährung,trainingsplan,workout,makros,protein,tracker`

**Beschreibung (Gerüst):**
- Aufhänger: Körper-Karte zum Antippen → passende Übungen mit Animationen.
- Ernährung: Kalorien & Makros, KI-Erkennung „sag, was du gegessen hast", Barcode-Scanner.
- Fortschritt: Gewichtsverlauf, Erfolge, Bestenliste.
- Vertrauen: Deutsch, DSGVO/Made-in-Germany, faire Free-Version.
- Premium: 9,99 €/Monat, monatlich kündbar.

> Differenzierung (für Store-Text & Marketing): **Körper-Karte als Übungsauswahl + „kein Equipment"-Modus + deutschsprachig/DSGVO-first.** Das nach vorne stellen, nicht generisches „Fitness + Ernährung".
