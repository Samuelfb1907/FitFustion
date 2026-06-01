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
