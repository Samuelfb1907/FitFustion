// Baut das SVG fuer die Lauf-Teilen-Karte (1080x1350, Instagram-4:5):
// oben der Karten-Schnappschuss (1080x900, weicher Verlauf zum Panel), unten ein dunkles
// Panel mit Titel/Datum, drei grossen Werten (mit Trennlinien), FitAvo-Avocado + Wordmark
// und kcal-Pille. Reines ESM ohne Deno-/Node-APIs, damit index.ts (Edge Function) und der
// lokale Design-Test dieselbe Quelle nutzen.

export const CARD_W = 1080;
export const CARD_H = 1350;
// Karten-Slot exakt 6:5 (1080x900) wie der angeforderte Schnappschuss-Ausschnitt ->
// keine Skalierung/kein Beschnitt -> Start-/Ziel-Punkte (dots, relative 0..1-Koordinaten)
// landen pixelgenau auf der Route.
const MAP_H = 900;
const ACCENT = '#19C98F';   // FitAvo-Gruen (Dark-Theme primary)
const ACCENT_DEEP = '#0B7A55';
const START = '#19C98F';
const END = '#F0574B';
const PANEL_TOP = '#131C25'; // Panel-Verlauf oben
const PANEL_BOT = '#090D12'; // Panel-Verlauf unten
const PANEL = '#0C1116';
const TXT = '#F3F6F8';
const MUTED = '#8A94A0';
const LABEL = '#7C8792';

function esc(v, max = 40) {
  return String(v ?? '')
    .slice(0, max)
    .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

// Karte: ENTWEDER mapLayerSvg (serverseitig aus Kacheln + Route gebaut, map-tiles.js)
// ODER legacy mapBase64/mapMime (Karten-Schnappschuss vom Client) + dots
// ({fx, fy, kind:'start'|'end'}, relative 0..1-Position im Ausschnitt).
// stats: [{label, value}] (max 3 genutzt).
// logoB64: transparentes FitAvo-Maskottchen (PNG-Base64, schickt der Client mit) - optional.
// scrim: dunkler Verlauf am Karten-Ende - nur fuer dunkle Karten (auf hellen wirkt er schmutzig).
export function buildCardSvg({ mapLayerSvg, mapBase64, mapMime, title, date, stats, kcalText, dots, logoB64, scrim = true }) {
  const cols = [180, 540, 900]; // zentrierte Spalten fuer bis zu 3 Werte
  const statSvg = (stats || []).slice(0, 3).map((s, i) => `
  <text x="${cols[i]}" y="1146" text-anchor="middle" font-family="Inter" font-size="62" font-weight="800" fill="#FFFFFF">${esc(s.value, 16)}</text>
  <text x="${cols[i]}" y="1198" text-anchor="middle" font-family="Inter" font-size="25" font-weight="500" letter-spacing="3" fill="${LABEL}">${esc(s.label, 20).toUpperCase()}</text>`).join('');

  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
  const dotSvg = (dots || []).slice(0, 2).map((d) => {
    const cx = Math.round(clamp01(d.fx) * CARD_W);
    const cy = Math.round(clamp01(d.fy) * MAP_H);
    return `
  <circle cx="${cx}" cy="${cy}" r="14" fill="${d.kind === 'end' ? END : START}" stroke="#FFFFFF" stroke-width="5"/>`;
  }).join('');

  // kcal-Pille rechts unten (Breite grob aus der Textlaenge geschaetzt).
  const kcal = esc(kcalText, 20);
  const kcalPill = kcal ? (() => {
    const w = Math.round(kcal.length * 15.4 + 52);
    return `
  <rect x="${1016 - w}" y="1248" width="${w}" height="56" rx="28" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="1.5"/>
  <text x="${1016 - 26}" y="1286" text-anchor="end" font-family="Inter" font-size="27" font-weight="500" fill="#D7DEE4">${kcal}</text>`;
  })() : '';

  // Avocado-Maskottchen (falls mitgeschickt); Wordmark rueckt sonst nach links.
  const logo = logoB64 ? `
  <image x="64" y="1240" width="59" height="64" xlink:href="data:image/png;base64,${logoB64}"/>` : '';
  const wordmarkX = logoB64 ? 139 : 64;

  // Karten-Ebene: serverseitig gebaute Kachel-Karte ODER legacy Client-Schnappschuss.
  const mapArea = mapLayerSvg ? mapLayerSvg : `<image x="0" y="0" width="${CARD_W}" height="${MAP_H}" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mapMime};base64,${mapBase64}"/>
  ${dotSvg}`;

  return `<svg width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <clipPath id="mapclip"><rect x="0" y="0" width="${CARD_W}" height="${MAP_H}"/></clipPath>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PANEL_TOP}"/><stop offset="1" stop-color="${PANEL_BOT}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ACCENT}"/><stop offset="1" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PANEL}" stop-opacity="0"/><stop offset="1" stop-color="${PANEL}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="${CARD_W}" height="${CARD_H}" fill="${PANEL}"/>
  ${mapArea}
  ${scrim ? `<rect x="0" y="${MAP_H - 130}" width="${CARD_W}" height="130" fill="url(#scrim)"/>` : ''}
  <rect x="0" y="${MAP_H - 6}" width="${CARD_W}" height="6" fill="url(#accent)"/>
  <rect x="0" y="${MAP_H}" width="${CARD_W}" height="${CARD_H - MAP_H}" fill="url(#panel)"/>
  <text x="64" y="1000" font-family="Inter" font-size="46" font-weight="800" fill="${TXT}">${esc(title, 24)}</text>
  <text x="1016" y="998" text-anchor="end" font-family="Inter" font-size="28" font-weight="500" fill="${MUTED}">${esc(date, 28)}</text>
  ${statSvg}
  <line x1="360" y1="1100" x2="360" y2="1204" stroke="#FFFFFF" stroke-opacity="0.09" stroke-width="2"/>
  <line x1="720" y1="1100" x2="720" y2="1204" stroke="#FFFFFF" stroke-opacity="0.09" stroke-width="2"/>
  ${logo}
  <text x="${wordmarkX}" y="1294" font-family="Inter" font-size="38" font-weight="800" fill="${TXT}">Fit<tspan fill="${ACCENT}">Avo</tspan></text>
  ${kcalPill}
</svg>`;
}
