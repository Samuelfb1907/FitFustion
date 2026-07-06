// Supabase Edge Function: notify-social
// Schickt dem ERSTELLER einer Aktivitaet einen Push, wenn ein Freund reagiert (Kudos/Kommentar).
// Serverseitig verifiziert (kein Client-Vertrauen): der Aufrufer muss wirklich reagiert haben,
// und man benachrichtigt nie sich selbst. Best-effort Push via Expo (wie send-nudge). Ohne
// Push-Token greift die In-App-Ansicht "Aktivitaet bei dir". Deploy MIT JWT-Pruefung (Standard):
//   supabase functions deploy notify-social
// Body: { "eventId": "<uuid>", "kind": "kudos" | "comment" }  ->  { "ok": true|false }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const me = ures?.user?.id;
    if (!me) return json({ ok: false }, 401);

    const body = await req.json().catch(() => ({}));
    const eventId = String(body?.eventId ?? '').trim();
    const kind = String(body?.kind ?? '').trim();
    if (!eventId || (kind !== 'kudos' && kind !== 'comment')) return json({ ok: false });

    const admin = createClient(url, service);

    // Ereignis + Ersteller. Nie sich selbst benachrichtigen.
    const { data: ev } = await admin.from('activity_events').select('user_id').eq('id', eventId).maybeSingle();
    if (!ev || ev.user_id === me) return json({ ok: true });
    const owner = ev.user_id as string;

    // Verifizieren, dass der Aufrufer wirklich reagiert hat (kein gefaelschter Push).
    let commentBody: string | null = null;
    if (kind === 'kudos') {
      const { data: k } = await admin.from('activity_kudos').select('event_id')
        .eq('event_id', eventId).eq('user_id', me).maybeSingle();
      if (!k) return json({ ok: true });
    } else {
      const { data: cm } = await admin.from('activity_comments').select('body')
        .eq('event_id', eventId).eq('user_id', me).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!cm) return json({ ok: true });
      commentBody = String(cm.body ?? '');
    }

    const { data: meProf } = await admin.from('profiles').select('first_name').eq('id', me).maybeSingle();
    const myName = (meProf?.first_name && String(meProf.first_name).trim()) || 'Ein Freund';

    // Push-Token des Erstellers (kein Token -> In-App-Fallback greift).
    const { data: tok } = await admin.from('push_tokens').select('token').eq('user_id', owner).maybeSingle();
    if (!tok?.token) return json({ ok: true });

    const bodyText = kind === 'kudos'
      ? `${myName} hat dir ein 🔥 gegeben`
      : `${myName}: „${commentBody ?? ''}“`.slice(0, 140);

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        to: tok.token,
        title: 'FitAvo',
        body: bodyText,
        sound: 'default',
        data: { type: 'social', eventId },
      }),
    }).catch(() => {});

    return json({ ok: true });
  } catch (_e) {
    return json({ ok: false }, 500);
  }
});
