# Supabase Edge Function: `delete-account` (DSGVO – echtes Konto-Löschen)

Die App löscht beim „Konto & alle Daten löschen" **immer** sämtliche Datenzeilen des Nutzers (client-seitig) und meldet ihn ab. Damit zusätzlich das **Login-Konto selbst** (`auth.users`) entfernt wird, brauchst du diese kleine Server-Funktion. Ohne sie bleiben die Daten zwar gelöscht, aber die E-Mail könnte sich theoretisch noch einloggen (mit leerem Konto).

> Solange die Funktion **nicht** deployed ist, funktioniert die App trotzdem – sie fällt automatisch auf „alle Daten löschen + abmelden" zurück.

## Variante A – über das Supabase-Dashboard (am einfachsten)
1. Supabase öffnen → linke Leiste **Edge Functions** → **Create function**.
2. Name: `delete-account`.
3. Den kompletten Code aus `supabase/functions/delete-account/index.ts` einfügen → **Deploy**.
4. Die Funktion braucht keine extra Secrets – `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` sind in Edge Functions automatisch verfügbar.

## Variante B – über die Supabase CLI
```bash
# einmalig
npm i -g supabase
supabase login
supabase link --project-ref <DEIN_PROJECT_REF>

# deployen (verify_jwt an, damit nur eingeloggte Nutzer aufrufen können)
supabase functions deploy delete-account
```

## Test
In der App: **Einstellungen → Datenschutz → Konto & alle Daten löschen**.
- Mit deployter Funktion: Konto + Daten komplett weg, Login nicht mehr möglich.
- Ohne Funktion: Daten weg + abgemeldet (Login-Eintrag bleibt leer bestehen).

> ⚠️ Hinweis: Der **Service-Role-Key** ist allmächtig und darf **nur serverseitig** (in der Edge Function) verwendet werden – niemals im App-Code/Client.

---

# Supabase Edge Function: `exercisedb-image` (Übungs-GIF-Proxy, Sicherheit)

Der **bezahlte** RapidAPI/ExerciseDB-Key steckt aktuell als `EXPO_PUBLIC_EXERCISEDB_KEY` im App-Bundle und ist damit aus jeder installierten App auslesbar. Diese Funktion holt die GIFs **serverseitig** (Key bleibt geheim), die App ruft dann nur noch den Proxy auf.

> Solange der Proxy **nicht** aktiv ist, funktioniert die App unverändert weiter (sie nutzt dann den bisherigen Client-Key). Es wird also nichts kaputt gemacht.

### Schritt 1 – Key bei RapidAPI rotieren
Da der alte Key öffentlich war: bei RapidAPI einen **neuen** ExerciseDB-Key erzeugen, den alten **löschen** und ein **Spend-Limit** setzen.

### Schritt 2 – Funktion deployen
**Dashboard:** Edge Functions → Create a function → Name `exercisedb-image` → Code aus `supabase/functions/exercisedb-image/index.ts` einfügen → Deploy. **„Verify JWT" kann ON bleiben** (Standard) – die App sendet automatisch den Supabase-Anon-Key mit.

**CLI:**
```bash
supabase functions deploy exercisedb-image
```

### Schritt 3 – Key als Secret hinterlegen (NICHT im Client!)
```bash
supabase secrets set EXERCISEDB_KEY=DEIN_NEUER_KEY
```
(oder Dashboard → Edge Functions → exercisedb-image → Secrets)

### Schritt 4 – App auf den Proxy umstellen
In den **EAS-Umgebungsvariablen (Preview)**:
- **`EXPO_PUBLIC_EXERCISEDB_PROXY` = `1`** hinzufügen
- **`EXPO_PUBLIC_EXERCISEDB_KEY`** entfernen (steckt jetzt serverseitig)

Beim nächsten Build lädt die App die GIFs über `…/functions/v1/exercisedb-image` – ganz ohne Key im Bundle.

### Test
Übungsdetail öffnen → das animierte GIF lädt weiterhin. (Schlägt der Abruf fehl, fällt die App automatisch auf die Muskelgrafik zurück – kein Crash.)
