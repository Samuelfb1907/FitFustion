// Supabase Edge Function: Proxy fuer ExerciseDB-GIFs (RapidAPI).
// Haelt den BEZAHLTEN RapidAPI-Key SERVERSEITIG (Secret EXERCISEDB_KEY), damit er
// nicht mehr im App-Bundle steckt und aus der App ausgelesen werden kann.
//
// Deploy (siehe SUPABASE_FUNCTIONS.md):
//   supabase functions deploy exercisedb-image --no-verify-jwt
//   supabase secrets set EXERCISEDB_KEY=DEIN_NEUER_KEY
// Danach in der App (EAS Preview-Env) setzen: EXPO_PUBLIC_EXERCISEDB_PROXY=1
// und EXPO_PUBLIC_EXERCISEDB_KEY entfernen.

const HOST = 'exercisedb.p.rapidapi.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    const exerciseId = url.searchParams.get('exerciseId');
    const resolution = url.searchParams.get('resolution') ?? '360';
    if (!exerciseId) {
      return new Response('missing exerciseId', { status: 400, headers: cors });
    }
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
