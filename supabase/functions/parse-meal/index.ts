// Supabase Edge Function: parse-meal
// Wandelt eine deutsche Mahlzeit-Beschreibung ("2 Eier, ein Toast und ein Kaffee")
// in strukturierte Tagebuch-Eintraege um - per Claude Haiku.
// Der ANTHROPIC_API_KEY liegt SERVERSEITIG als Secret (nie im App-Bundle).
//
// Deploy MIT JWT-Pruefung (Standard, NICHT --no-verify-jwt): die App ruft mit dem
// eingeloggten Nutzer-Token auf.
//   supabase secrets set ANTHROPIC_API_KEY=...
//   supabase functions deploy parse-meal
//
// Schutz vor Kostenexplosion (Denial-of-Wallet):
//   - Nutzer-ID wird aus dem JWT ermittelt (zusaetzlich zur Gateway-Pruefung).
//   - Pro Nutzer gilt ein TAGESLIMIT (DAILY_LIMIT) ueber die DB-Funktion bump_ai_usage
//     (Migration 027_ai_rate_limit.sql). Ohne diese Migration laeuft die Function
//     "fail-open" weiter (kein Limit), damit die Reihenfolge von Deploy/Migration egal ist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const DAILY_LIMIT = 60; // KI-Analysen pro Nutzer und Tag (reichlich fuer echte Nutzung, bremst Missbrauch)

// Strukturierte Ausgabe erzwingen (Structured Outputs) -> garantiert gueltiges JSON.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'amount_g', 'meal_type', 'kcal', 'protein', 'carbs', 'fat'],
        properties: {
          name: { type: 'string' },
          amount_g: { type: 'number' },
          meal_type: { type: 'string', enum: MEALS },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
      },
    },
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'server not configured' }, 500);

    // 1) Aufrufer aus dem mitgesendeten JWT ermitteln (Defense-in-Depth + Nutzer-ID fuer das Limit).
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'unauthorized' }, 401);

    // 2) Eingabe pruefen (bevor wir das Limit verbrauchen).
    const payload = await req.json().catch(() => ({} as any));
    const text: string = typeof payload.text === 'string' ? payload.text : '';
    if (!text.trim() || text.length > 500) return json({ error: 'invalid text' }, 400);
    const meal = MEALS.includes(payload.defaultMeal) ? payload.defaultMeal : 'snack';

    // 3) Tageslimit pruefen+hochzaehlen (atomar in der DB). Fehlt die DB-Funktion noch
    //    (Migration nicht eingespielt), laufen wir bewusst fail-open weiter.
    try {
      const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (service) {
        const admin = createClient(url, service, { auth: { persistSession: false } });
        const { data: allowed, error: rlErr } = await admin.rpc('bump_ai_usage', {
          p_user: user.id,
          p_limit: DAILY_LIMIT,
        });
        if (rlErr) {
          console.error('parse-meal rate-limit check failed (fail-open):', rlErr.message);
        } else if (allowed === false) {
          return json(
            { error: 'rate_limited', message: 'Tageslimit fuer KI-Analysen erreicht. Bitte morgen wieder versuchen oder Eintraege manuell hinzufuegen.' },
            429,
          );
        }
      }
    } catch (e) {
      console.error('parse-meal rate-limit error (fail-open):', e);
    }

    const system =
      'Du bist ein praeziser Ernaehrungs-Parser fuer eine deutsche Tracking-App. ' +
      'Zerlege die Mahlzeit-Beschreibung des Nutzers in einzelne Lebensmittel. Fuer JEDES gib an:\n' +
      '- name: kurzer deutscher Name (z. B. "Vollkornbrot", "Ei", "Hafermilch-Latte").\n' +
      '- amount_g: die GEGESSENE Gesamtmenge in Gramm (Getraenke in ml ~= g). Schaetze aus Alltagsmengen: ' +
      '1 Ei ~60 g, 1 Scheibe Brot/Toast ~30 g, 1 Broetchen ~60 g, 1 Glas/Tasse ~200 g, 1 Portion ~150 g, 1 EL ~15 g.\n' +
      '- meal_type: breakfast | lunch | dinner | snack. Wenn der Text es nennt ("zum Fruehstueck"), nutze das, sonst "' + meal + '".\n' +
      '- kcal, protein, carbs, fat: realistische Durchschnitts-Naehrwerte PRO 100 g (protein/carbs/fat in Gramm).\n' +
      'Nur tatsaechlich genannte Lebensmittel - keine Erfindungen. Antworte ausschliesslich im vorgegebenen JSON-Format.';

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: text }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      console.error('parse-meal ai error:', r.status, detail);
      return json({ error: 'ai_error' }, 502);
    }
    const data = await r.json();
    const txt = (data.content ?? []).find((b: any) => b.type === 'text')?.text ?? '{"items":[]}';
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { parsed = { items: [] }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return json({ items });
  } catch (e) {
    console.error('parse-meal error:', e);
    return json({ error: 'server error' }, 500);
  }
});
