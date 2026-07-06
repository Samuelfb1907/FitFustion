// Baut das SVG fuer die Lauf-Teilen-Karte (1080x1350, Instagram-4:5):
// oben der Karten-Schnappschuss (1080x894), unten ein dunkles Panel mit
// Titel/Datum, drei grossen Werten (Distanz/Zeit/Tempo) und FitAvo-Wordmark.
// Reines ESM ohne Deno-/Node-APIs, damit index.ts (Edge Function) und der
// lokale Design-Test dieselbe Quelle nutzen.

export const CARD_W = 1080;
export const CARD_H = 1350;
const MAP_H = 894;
const ACCENT = '#19C98F';   // FitAvo-Gruen (Dark-Theme primary)
const PANEL = '#0C1116';    // Panel-Hintergrund (dunkel, wie App-Dark-bg)
const TXT = '#F3F6F8';
const MUTED = '#8A94A0';
const LABEL = '#7C8792';

function esc(v, max = 40) {
  return String(v ?? '')
    .slice(0, max)
    .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
}

// mapBase64: PNG/JPEG-Base64 OHNE "data:"-Prefix. stats: [{label, value}] (max 3 genutzt).
export function buildCardSvg({ mapBase64, mapMime, title, date, stats, kcalText }) {
  const cols = [180, 540, 900]; // zentrierte Spalten fuer bis zu 3 Werte
  const statSvg = (stats || []).slice(0, 3).map((s, i) => `
  <text x="${cols[i]}" y="1146" text-anchor="middle" font-family="Inter" font-size="62" font-weight="800" fill="#FFFFFF">${esc(s.value, 16)}</text>
  <text x="${cols[i]}" y="1198" text-anchor="middle" font-family="Inter" font-size="25" font-weight="500" letter-spacing="3" fill="${LABEL}">${esc(s.label, 20).toUpperCase()}</text>`).join('');

  return `<svg width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="${CARD_W}" height="${CARD_H}" fill="${PANEL}"/>
  <image x="0" y="0" width="${CARD_W}" height="${MAP_H}" preserveAspectRatio="xMidYMid slice" xlink:href="data:${mapMime};base64,${mapBase64}"/>
  <rect x="0" y="${MAP_H}" width="${CARD_W}" height="6" fill="${ACCENT}"/>
  <rect x="0" y="${MAP_H + 6}" width="${CARD_W}" height="${CARD_H - MAP_H - 6}" fill="${PANEL}"/>
  <text x="64" y="1000" font-family="Inter" font-size="46" font-weight="800" fill="${TXT}">${esc(title, 24)}</text>
  <text x="1016" y="998" text-anchor="end" font-family="Inter" font-size="28" font-weight="500" fill="${MUTED}">${esc(date, 28)}</text>
  ${statSvg}
  <text x="64" y="1298" font-family="Inter" font-size="36" font-weight="800" fill="${TXT}">Fit<tspan fill="${ACCENT}">Avo</tspan></text>
  <text x="1016" y="1295" text-anchor="end" font-family="Inter" font-size="28" font-weight="500" fill="#B9C2C9">${esc(kcalText, 20)}</text>
</svg>`;
}
