// Supabase Edge Function: render-run-card
// Setzt das Teilen-Bild fuer einen GPS-Lauf zusammen: Karten-Schnappschuss (vom Client)
// + Werte-Panel (Distanz/Zeit/Tempo, kcal, Datum, FitAvo-Wordmark) -> fertiges PNG.
// Grund: Der App-Build hat kein natives Modul, um Text in Bilder zu zeichnen - so bleibt
// das Feature OTA-faehig. Das Bild wird NUR verarbeitet und NICHT gespeichert.
// Alle Texte kommen fertig formatiert/uebersetzt vom Client (Server = reiner Setzkasten).
// Deploy MIT JWT-Pruefung (Standard): supabase functions deploy render-run-card
// Body: { map: base64-PNG/JPEG, title, date, stats: [{label, value}], kcalText }
// Antwort: { image: base64-PNG (1080x1350) }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initWasm, Resvg } from 'https://esm.sh/@resvg/resvg-wasm@2.6.2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { buildCardSvg } from './card-svg.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// WASM-Renderer + Inter-Schriften einmal pro Instanz laden (Cold Start ~2 s, danach sofort).
// Schlaegt der Download fehl, wird beim naechsten Aufruf neu versucht (ready zuruecksetzen).
let fonts: Uint8Array[] = [];
let wasmDone = false; // initWasm darf nur EINMAL pro Instanz laufen
let ready: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (!wasmDone) {
        await initWasm(fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'));
        wasmDone = true;
      }
      fonts = await Promise.all([
        'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.4.2/800ExtraBold/Inter_800ExtraBold.ttf',
        'https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.4.2/500Medium/Inter_500Medium.ttf',
      ].map(async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer())));
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // Nur eingeloggte Nutzer (verhindert anonymen Missbrauch mit dem oeffentlichen anon-Key).
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user?.id) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const map = String(body?.map ?? '');
    // Karten-Bild pruefen: Base64, plausible Groesse, PNG oder JPEG.
    if (map.length < 100 || map.length > 6_000_000 || !/^[A-Za-z0-9+/=]+$/.test(map)) return json({ error: 'bad_map' }, 400);
    const mapMime = map.startsWith('iVBOR') ? 'image/png' : map.startsWith('/9j/') ? 'image/jpeg' : null;
    if (!mapMime) return json({ error: 'bad_map' }, 400);

    const stats = Array.isArray(body?.stats) ? body.stats.slice(0, 3).map((s: any) => ({
      label: String(s?.label ?? ''), value: String(s?.value ?? ''),
    })) : [];
    // Start-/Ziel-Punkte: relative Koordinaten (0..1) im Karten-Ausschnitt.
    const dots = Array.isArray(body?.dots) ? body.dots.slice(0, 2).map((d: any) => ({
      fx: Number(d?.fx), fy: Number(d?.fy), kind: d?.kind === 'end' ? 'end' : 'start',
    })).filter((d: any) => isFinite(d.fx) && isFinite(d.fy)) : [];

    await ensureReady();
    const svg = buildCardSvg({
      mapBase64: map, mapMime,
      title: String(body?.title ?? ''), date: String(body?.date ?? ''),
      stats, kcalText: String(body?.kcalText ?? ''), dots,
    });
    const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Inter', loadSystemFonts: false } });
    const png = resvg.render().asPng();
    return json({ image: encodeBase64(png) });
  } catch (e) {
    console.error('render-run-card:', e);
    return json({ error: 'render_failed' }, 500);
  }
});
