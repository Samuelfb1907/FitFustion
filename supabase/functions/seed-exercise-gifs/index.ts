// EINMALIGE Seed-Function: holt das ExerciseDB-Mapping (id -> gif-Dateiname) vom
// jsDelivr-CDN und traegt es in public.exercise_gif ein (id, hash). Idempotent (Upsert).
// Danach liest die exercisedb-image-Function daraus. Quelle: hasaneyldrm/exercises-dataset.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SRC = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/data/exercises.json';

Deno.serve(async () => {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response('missing env', { status: 500 });
    }
    const res = await fetch(SRC);
    if (!res.ok) {
      return new Response('source fetch failed: ' + res.status, { status: 502 });
    }
    const data = await res.json();
    const rows: { id: string; hash: string }[] = [];
    for (const e of data) {
      if (!e || !e.id || !e.gif_url) continue;
      const prefix = 'videos/' + e.id + '-';
      if (e.gif_url.startsWith(prefix) && e.gif_url.endsWith('.gif')) {
        rows.push({ id: e.id, hash: e.gif_url.slice(prefix.length, -4) });
      }
    }
    const up = await fetch(`${SUPABASE_URL}/rest/v1/exercise_gif?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });
    const txt = await up.text();
    return new Response(
      JSON.stringify({ fetched: data.length, upserted: rows.length, restStatus: up.status, restBody: txt.slice(0, 300) }),
      { status: up.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response('error: ' + String(e), { status: 500 });
  }
});
