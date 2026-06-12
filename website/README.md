# FitAvo Website (fitavo.eu)

Statische Website (HTML/CSS/JS, keine Abhängigkeiten, keine Build-Schritte) im FitAvo-Design,
mit Scroll-Animationen. Läuft auf jedem normalen Webhosting – auch IONOS.

## Inhalt / Struktur

```
website/
├─ index.html                      → Startseite (Landingpage)
├─ styles.css                      → gesamtes Design
├─ script.js                       → Animationen & Interaktionen
├─ favicon.svg                     → Browser-Symbol
├─ datenschutzerklaerung/index.html → /datenschutzerklaerung/
├─ nutzungsbedingungen/index.html   → /nutzungsbedingungen/
└─ impressum/index.html             → /impressum/
```

Die Rechtsseiten liegen bewusst unter denselben URLs, die schon in App Store Connect
hinterlegt sind (z. B. `https://www.fitavo.eu/datenschutzerklaerung/`) – so bleibt der
Datenschutz-Link in der App-Einreichung gültig.

## Hochladen zu IONOS (klassisches Webhosting)

1. IONOS einloggen → **Hosting** → dein Paket → **Webspace** öffnen
   (oder per SFTP/FTP, z. B. mit dem kostenlosen Programm „FileZilla").
2. In den **Stammordner der Website** wechseln (heißt je nach Paket
   `htdocs`, `httpdocs` oder ist direkt der Hauptordner deiner Domain).
3. Den **kompletten Inhalt** des Ordners `website/` dort hineinladen –
   **mit den Unterordnern** (`datenschutzerklaerung`, `nutzungsbedingungen`, `impressum`).
   Also: `index.html`, `styles.css`, `script.js`, `favicon.svg` + die 3 Ordner.
4. Fertig. Aufrufen:
   - `https://www.fitavo.eu/` → Startseite
   - `https://www.fitavo.eu/datenschutzerklaerung/`
   - `https://www.fitavo.eu/nutzungsbedingungen/`
   - `https://www.fitavo.eu/impressum/`

> ⚠️ **Hinweis:** Das ersetzt deine jetzige Startseite. Sichere vorher die alten Dateien,
> falls du sie behalten willst. Die alten Rechtstext-Seiten werden durch die neuen ersetzt.

## Falls du den IONOS Homepage-Baukasten (MyWebsite) nutzt

Dann lassen sich reine HTML-Dateien nicht so einfach hochladen. Zwei Wege:
- Im IONOS-Konto auf ein **Webhosting-Paket** mit Datei-Zugriff umstellen (empfohlen für diese Seite), **oder**
- die Inhalte im Baukasten nachbauen (Texte stehen alle in diesen Dateien) – sag mir Bescheid, dann helfe ich.

## Vorschau vor dem Hochladen

- Am einfachsten über das **Vorschau-Panel** hier in der Entwicklungsumgebung.
- Lokal: ein kleiner Webserver, z. B. im Ordner `website/`:
  `npx serve` (dann die angezeigte Adresse im Browser öffnen).
- Hinweis: Ein **Doppelklick** auf `index.html` zeigt das Design NICHT korrekt –
  die Pfade zeigen auf den Server-Root (`/styles.css`). Auf fitavo.eu ist das genau richtig.

## Anpassen

- Texte/Preise: direkt in den HTML-Dateien.
- Farben/Abstände: oben in `styles.css` unter `:root`.
- Echte App-Store-Buttons: sobald die App live ist, in `index.html` den Abschnitt
  `#download` (Klasse `store-badge soon`) mit dem echten App-Store-Link versehen.
