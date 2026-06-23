// Supabase Edge Function: send-nudge
// Stupst einen FREUND an. Serverseitig (kein Client-Vertrauen): prueft Freundschaft +
// 15-Minuten-Limit pro Empfaenger, traegt den Stups in nudges ein (In-App-Fallback) und
// schickt - falls der Empfaenger einen Push-Token hat (push_tokens, Migration 046) - eine
// echte Push-Mitteilung via Expo. Deploy MIT JWT-Pruefung (Standard):
//   supabase functions deploy send-nudge
// Body: { "code": "<friend_code>" }  ->  { "status": "sent"|"too_soon"|"not_friend"|"error" }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const RATE_LIMIT_MIN = 15; // hoechstens 1 Stups pro Empfaenger alle 15 Minuten

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Aufrufer aus dem JWT ermitteln.
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const me = ures?.user?.id;
    if (!me) return json({ status: 'error' }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? '').trim().toUpperCase();
    if (!code) return json({ status: 'error' });

    const admin = createClient(url, service);

    // Empfaenger per Freund-Code aufloesen.
    const { data: target } = await admin.from('profiles').select('id, first_name').eq('friend_code', code).maybeSingle();
    if (!target || target.id === me) return json({ status: 'error' });

    // Nur befreundete anstupsen.
    const { data: fr } = await admin.from('friendships').select('user_id').eq('user_id', me).eq('friend_id', target.id).maybeSingle();
    if (!fr) return json({ status: 'not_friend' });

    // 15-Minuten-Limit pro Empfaenger.
    const since = new Date(Date.now() - RATE_LIMIT_MIN * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from('nudges').select('id')
      .eq('from_user', me).eq('to_user', target.id).gte('created_at', since).limit(1);
    if (recent && recent.length > 0) return json({ status: 'too_soon' });

    const { data: meProf } = await admin.from('profiles').select('first_name').eq('id', me).maybeSingle();
    const myName = (meProf?.first_name && String(meProf.first_name).trim()) || 'Ein Freund';

    // Eintrag (In-App-Fallback, falls kein Push-Token / App offen).
    await admin.from('nudges').insert({ from_user: me, to_user: target.id, from_name: myName });

    // Echter Push (best effort) - nur wenn der Empfaenger einen Token hat.
    const { data: tok } = await admin.from('push_tokens').select('token').eq('user_id', target.id).maybeSingle();
    if (tok?.token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          to: tok.token,
          title: 'FitAvo',
          body: `${myName} hat dich angestupst – auf geht's! 💪`,
          sound: 'default',
        }),
      }).catch(() => {});
    }

    return json({ status: 'sent' });
  } catch (_e) {
    return json({ status: 'error' }, 500);
  }
});
