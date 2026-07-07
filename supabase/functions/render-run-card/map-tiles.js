// Baut die Karten-Ebene fuer das Teilen-Bild SERVERSEITIG aus CARTO-/OSM-Kacheln
// (dark_all: Strassen + Strassennamen, aber KEINE Laeden/POIs) und zeichnet die Route
// selbst als glatte Linie mit Start-/Ziel-Punkt - pixelgenau, weil Kacheln und Route
// dieselbe Web-Mercator-Projektion nutzen. Kein Apple-Schnappschuss mehr noetig.
// Reines ESM (fetch gibt es in Deno UND Node 18+), damit der lokale Design-Test
// dieselbe Quelle nutzt.

const TILE_WORLD = 256; // Weltgroesse einer Kachel in Mercator-Pixeln (Zoom z)
// Kartenstile:
//  - "satellite": echtes Luftbild (Esri World Imagery) - der "realistische" Strava-Look.
//  - CARTO-Stile ("voyager", "voyager_nolabels", "light_all", "dark_all"): gezeichnete
//    Karten ohne Laeden/POIs.
const STYLES = {
  satellite: {
    url: (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: '© Esri · Maxar · Earthstar Geographics',
    maxZoom: 19,
    mime: 'image/jpeg',
    darkGround: true, // Luftbild ist meist eher dunkel -> weisse Route-Kontur, helle Attribution
  },
};
const cartoStyle = (name, dark) => ({
  url: (z, x, y) => `https://basemaps.cartocdn.com/rastertiles/${name}/${z}/${x}/${y}@2x.png`,
  attribution: '© OpenStreetMap · © CARTO',
  maxZoom: 18,
  mime: 'image/png',
  darkGround: dark,
});
STYLES.voyager = cartoStyle('voyager', false);
STYLES.voyager_nolabels = cartoStyle('voyager_nolabels', false);
STYLES.light_all = cartoStyle('light_all', false);
STYLES.dark_all = cartoStyle('dark_all', true);

// Kachel mit Wiederholversuchen laden (einzelne Kacheln haengen gelegentlich).
async function fetchTile(url) {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'FitAvo/1.2 (Fitness-App; Lauf-Teilen-Bild)' } });
      if (res.ok) return await res.arrayBuffer();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 150 * (i + 1)));
  }
  throw lastErr;
}

function mercX(lng, z) { return ((lng + 180) / 360) * TILE_WORLD * 2 ** z; }
function mercY(lat, z) {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_WORLD * 2 ** z;
}

function b64FromBuffer(buf) {
  // ArrayBuffer -> Base64 (chunked, damit grosse Kacheln nicht am Stack scheitern)
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}

// region: {latitude, longitude, latitudeDelta, longitudeDelta} (Ausschnitt, Seitenverhaeltnis W:H)
// route: [{lat, lng}, ...] (vereinfacht, in Reihenfolge)
// Liefert ein SVG-Fragment (Kacheln + Route + Punkte + Attribution), geclippt auf W x H.
// Standard "voyager_nolabels" (CARTO/OSM): gezeichnete Karte ohne jegliche Labels.
// BEWUSST KEIN Luftbild ("satellite"): zeigt im Zweifel das Wohnhaus -> Datenschutz.
export async function buildMapLayer({ region, route, width, height, accent = '#19C98F', endColor = '#F0574B', style = 'voyager_nolabels' }) {
  const st = STYLES[style] ?? STYLES.voyager_nolabels;
  // Zoom so waehlen, dass der Ausschnitt die Breite fuellt (Skalierung s in [1, 2) ->
  // Kacheln bleiben scharf und es sind hoechstens ~6x5 Kacheln zu laden).
  const zf = Math.log2((width * 360) / (TILE_WORLD * region.longitudeDelta));
  const z = Math.max(3, Math.min(st.maxZoom, Math.floor(zf)));
  const s = width / ((region.longitudeDelta / 360) * TILE_WORLD * 2 ** z);

  const cx = mercX(region.longitude, z);
  const cy = mercY(region.latitude, z);
  const viewLeft = cx - width / 2 / s;
  const viewTop = cy - height / 2 / s;

  const maxTile = 2 ** z;
  const txMin = Math.floor(viewLeft / TILE_WORLD);
  const txMax = Math.floor((viewLeft + width / s) / TILE_WORLD);
  const tyMin = Math.max(0, Math.floor(viewTop / TILE_WORLD));
  const tyMax = Math.min(maxTile - 1, Math.floor((viewTop + height / s) / TILE_WORLD));

  // Kacheln parallel laden (x wrappt um die Datumsgrenze, y ist geklemmt).
  const jobs = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      const wx = ((tx % maxTile) + maxTile) % maxTile;
      jobs.push((async () => {
        const b64 = b64FromBuffer(await fetchTile(st.url(z, wx, ty)));
        // Kacheln 1 px ueberlappen lassen - sonst entstehen an den Kachel-Grenzen
        // sichtbare helle Naehte (Anti-Aliasing der Bildraender auf Bruchteil-Pixeln).
        const px = (tx * TILE_WORLD - viewLeft) * s;
        const py = (ty * TILE_WORLD - viewTop) * s;
        const size = TILE_WORLD * s + 1;
        return `<image x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" preserveAspectRatio="none" xlink:href="data:${st.mime};base64,${b64}"/>`;
      })());
    }
  }
  if (jobs.length === 0 || jobs.length > 48) throw new Error(`unexpected tile count: ${jobs.length}`);
  const tileSvg = (await Promise.all(jobs)).join('\n  ');

  // Route in Bild-Pixel projizieren (gleiche Projektion wie die Kacheln -> liegt exakt auf der Strasse).
  const pts = (route || []).map((p) => {
    const x = (mercX(p.lng, z) - viewLeft) * s;
    const y = (mercY(p.lat, z) - viewTop) * s;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  let routeSvg = '';
  if (pts.length > 1) {
    const first = pts[0].split(','), last = pts[pts.length - 1].split(',');
    // Kontur um die Route: WEISS auf Luftbild/hellen Karten (Sticker-Look), dunkel auf dunklen.
    const casing = st.darkGround && style !== 'satellite' ? '#06251B' : '#FFFFFF';
    const casingOpacity = casing === '#FFFFFF' ? '0.9' : '0.45';
    routeSvg = `
  <polyline points="${pts.join(' ')}" fill="none" stroke="${casing}" stroke-opacity="${casingOpacity}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${first[0]}" cy="${first[1]}" r="13" fill="${accent}" stroke="#FFFFFF" stroke-width="5"/>
  <circle cx="${last[0]}" cy="${last[1]}" r="13" fill="${endColor}" stroke="#FFFFFF" stroke-width="5"/>`;
  }

  // Pflicht-Attribution fuers Kartenmaterial, dezent unten links (Schatten fuer Lesbarkeit
  // auf wechselndem Untergrund, z. B. Luftbild).
  const attrFill = st.darkGround ? '#FFFFFF' : '#3E4A55';
  const attribution = `<text x="19" y="${height - 15}" font-family="Inter" font-size="17" font-weight="500" fill="#000000" fill-opacity="0.35">${st.attribution}</text>
  <text x="18" y="${height - 16}" font-family="Inter" font-size="17" font-weight="500" fill="${attrFill}" fill-opacity="0.75">${st.attribution}</text>`;

  return `<g clip-path="url(#mapclip)">
  ${tileSvg}
  ${routeSvg}
  ${attribution}
  </g>`;
}
