// Supabase Edge Function: Proxy fuer ExerciseDB-GIFs (RapidAPI).
// Haelt den BEZAHLTEN RapidAPI-Key SERVERSEITIG (Secret EXERCISEDB_KEY), damit er
// nicht mehr im App-Bundle steckt und aus der App ausgelesen werden kann.
//
// Deploy (siehe SUPABASE_FUNCTIONS.md) - MIT JWT-Pruefung (NICHT --no-verify-jwt!),
// damit kein voellig offener Proxy entsteht, der den bezahlten Key abgreifen laesst.
// Die App sendet den Anon-Key als Bearer-JWT -> kommt durch die Pruefung.
//   supabase functions deploy exercisedb-image
//   supabase secrets set EXERCISEDB_KEY=DEIN_NEUER_KEY
// WICHTIG: Bei RapidAPI zusaetzlich ein Ausgaben-/Spend-Limit setzen (Kostenschutz).
// Danach in der App (EAS Preview-Env): EXPO_PUBLIC_EXERCISEDB_PROXY=1 setzen.

const HOST = 'exercisedb.p.rapidapi.com';
const ALLOWED_RES = ['180', '360', '720'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    const exerciseId = url.searchParams.get('exerciseId') ?? '';
    const resParam = url.searchParams.get('resolution') ?? '360';
    // Eingaben strikt validieren -> begrenzt die Missbrauchs-/Kostenf-Oberflaeche.
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(exerciseId)) {
      return new Response('invalid exerciseId', { status: 400, headers: cors });
    }
    const resolution = ALLOWED_RES.includes(resParam) ? resParam : '360';
    const key = Deno.env.get('EXERCISEDB_KEY');
    if (!key) {
      return new Response('server not configured', { status: 500, headers: cors });
    }

    const upstream = `https://${HOST}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=${encodeURIComponent(resolution)}`;
    const r = await fetch(upstream, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': HOST } });
    if (!r.ok) {
      return new Response('upstream error', { status: r.status, headers: cors });
    }

    const body = await r.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': r.headers.get('Content-Type') ?? 'image/gif',
        // GIFs sind unveraenderlich -> aggressiv cachen (Edge-/Client-Cache)
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: cors });
  }
});
