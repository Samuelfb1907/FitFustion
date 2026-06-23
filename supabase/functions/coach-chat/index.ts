// Supabase Edge Function: coach-chat ("Frag den Coach", #1)
// Beantwortet Fitness-/Ernaehrungs-/Motivationsfragen per Claude. Premium-only + KI-Tageslimit
// (bump_ai_usage, Migration 027) + DSGVO-Einwilligung (ai_consent_at) - genau wie parse-meal.
// Antworten als Klartext (kein JSON-Schema). Deploy MIT JWT-Pruefung (Standard).
//   supabase functions deploy coach-chat
// Body: { messages: [{role:'user'|'assistant', content}], lang }  ->  { reply } | { error }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const DAILY_LIMIT = 60;            // KI-Aktionen pro Nutzer/Tag (geteilt mit parse-meal)
const MODEL = 'claude-sonnet-4-6'; // gute Beratungsqualitaet, kostenbewusst (Opus waere teurer)

const systemDe =
  'Du bist der FitAvo-Coach: ein motivierender, fundierter Fitness- und Ernaehrungs-Coach in einer Trainings-App. ' +
  'Beantworte Fragen zu Training, Uebungstechnik, Ernaehrungs-Prinzipien und Motivation - kurz, konkret und ermutigend ' +
  '(hoechstens ~150 Woerter, gern 2-4 knackige Stichpunkte). Sprich den Nutzer mit "du" an. ' +
  'Erstelle KEINE kompletten Rezepte oder fertigen Ernaehrungsplaene - gib stattdessen allgemeine Prinzipien, Richtwerte und Beispiele. ' +
  'Keine medizinischen Diagnosen oder Heilversprechen; bei Schmerzen oder gesundheitlichen Problemen empfiehl freundlich, eine Aerztin/einen Arzt aufzusuchen. ' +
  'Keine gefaehrlichen oder extremen Ratschlaege (z. B. sehr starke Kaloriendefizite, Dopingmittel, Erbrechen). Antworte auf Deutsch.';
const systemEn =
  'You are the FitAvo Coach: a motivating, knowledgeable fitness & nutrition coach inside a training app. ' +
  'Answer questions about training, exercise technique, nutrition principles and motivation - short, concrete and encouraging ' +
  '(at most ~150 words, ideally 2-4 crisp bullet points). Address the user informally. ' +
  'Do NOT create full recipes or complete meal plans - give general principles, ranges and examples instead. ' +
  'No medical diagnoses or cure promises; for pain or health issues, kindly suggest seeing a doctor. ' +
  'No dangerous or extreme advice (e.g. very large calorie deficits, doping, purging). Answer in English.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'server_not_configured' }, 500);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'unauthorized' }, 401);

    const admin = service ? createClient(url, service, { auth: { persistSession: false } }) : null;
    const reader = admin ?? userClient;
    try {
      const { data: prof } = await reader.from('profiles').select('is_premium, ai_consent_at').eq('id', user.id).maybeSingle();
      if (prof && prof.is_premium !== true) return json({ error: 'premium_required' });
      if (prof && !prof.ai_consent_at) return json({ error: 'consent_required' });
    } catch (e) {
      console.error('coach-chat premium/consent check failed (fail-open):', e);
    }

    // Tageslimit (geteilt mit parse-meal).
    try {
      if (admin) {
        const { data: allowed, error: rlErr } = await admin.rpc('bump_ai_usage', { p_user: user.id, p_limit: DAILY_LIMIT });
        if (!rlErr && allowed === false) return json({ error: 'rate_limited' });
      }
    } catch (e) {
      console.error('coach-chat rate-limit error (fail-open):', e);
    }

    const payload = await req.json().catch(() => ({} as any));
    const lang = payload.lang === 'en' ? 'en' : 'de';
    const raw = Array.isArray(payload.messages) ? payload.messages : [];
    const messages = raw
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1000) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'invalid' }, 400);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: lang === 'en' ? systemEn : systemDe,
        messages,
      }),
    });
    if (!r.ok) {
      console.error('coach-chat ai error:', r.status, (await r.text()).slice(0, 300));
      return json({ error: 'ai_error' });
    }
    const data = await r.json();
    const reply = (data.content ?? []).find((b: any) => b.type === 'text')?.text ?? '';
    return json({ reply });
  } catch (e) {
    console.error('coach-chat error:', e);
    return json({ error: 'server_error' }, 500);
  }
});
