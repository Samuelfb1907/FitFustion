// Supabase Edge Function: loescht das aufrufende Auth-Konto (Recht auf Loeschung, DSGVO Art. 17).
// Da alle App-Tabellen "on delete cascade" auf auth.users zeigen, werden dabei ALLE Daten mitgeloescht.
// Deploy-Anleitung siehe SUPABASE_FUNCTIONS.md.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Aufrufer aus dem mitgesendeten JWT ermitteln
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // 2) Mit Service-Role das Konto loeschen (Cascade entfernt alle abhaengigen Daten)
    const admin = createClient(url, service);
    const { error: dErr } = await admin.auth.admin.deleteUser(user.id);
    if (dErr) {
      return new Response(JSON.stringify({ error: dErr.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
