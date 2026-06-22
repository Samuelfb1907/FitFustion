# OTA-Updates (Over-the-Air) – FitAvo

Mit OTA-Updates kannst du **reine JavaScript-Änderungen** (neue Screens, Texte, Logik,
Bugfixes – also fast alles, was wir bauen) **direkt an deine Nutzer schicken, OHNE einen
neuen App-Store-Build**. Gratis, sofort, ohne EAS-Build-Guthaben zu verbrauchen.

Eingerichtet mit `expo-updates` + `runtimeVersion: appVersion` (app.json) und Update-Kanälen
in `eas.json` (`development` / `preview` / `production`).

## Wichtig: einmaliger Bootstrap-Build
OTA funktioniert **erst ab dem ersten Build, der `expo-updates` enthält**. Der aktuell im
Store liegende Build kennt OTA noch nicht. Also:
1. **Einmal** einen `production`-Build machen + im App Store veröffentlichen (sobald dein
   EAS-Guthaben zurückgesetzt ist). Dieser Build enthält jetzt automatisch `expo-updates`.
2. **Ab dann** gehen alle JS-Änderungen per OTA – **ohne weiteren Build**.

## Ein OTA-Update veröffentlichen
Im Ordner `app/`:

```
eas update --branch production --message "Was sich geaendert hat"
```

- Die Nutzer bekommen das Update **beim nächsten App-Start** (es lädt im Hintergrund und ist
  beim übernächsten Öffnen aktiv).
- Beim allerersten Mal richtet `eas update --branch production ...` den Branch automatisch ein
  (falls eine Rückfrage kommt: bestätigen). Notfalls vorher einmal `eas update:configure`.

## Wann brauchst du DOCH einen neuen Build?
Nur wenn sich **native Bausteine** ändern, z. B.:
- ein neues natives Modul (`npx expo install <native-paket>`),
- App-Icon/Splash/Berechtigungen/`app.json`-Native-Konfig,
- SDK-Upgrade.

Faustregel: Haben wir nur `.ts/.tsx`-Dateien geändert → **OTA reicht**. Kam ein neues
`expo-*`/`react-native-*`-Paket dazu → **Build nötig** (danach wieder OTA).

## Versionen
`runtimeVersion` folgt der `version` in `app.json` (Policy `appVersion`). Ein OTA-Update
passt nur zu Builds mit **gleicher** `version`. Wenn du native Sachen änderst, erhöhe die
`version` (z. B. 1.0.0 → 1.1.0) und mach einen neuen Build – dann gehört das OTA wieder dazu.
