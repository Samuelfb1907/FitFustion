// Baut die Karten-Ebene fuer das Teilen-Bild SERVERSEITIG aus CARTO-/OSM-Kacheln
// (dark_all: Strassen + Strassennamen, aber KEINE Laeden/POIs) und zeichnet die Route
// selbst als glatte Linie mit Start-/Ziel-Punkt - pixelgenau, weil Kacheln und Route
// dieselbe Web-Mercator-Projektion nutzen. Kein Apple-Schnappschuss mehr noetig.
// Reines ESM (fetch gibt es in Deno UND Node 18+), damit der lokale Design-Test
// dieselbe Quelle nutzt.

const TILE_WORLD = 256; // Weltgroesse einer Kachel in Mercator-Pixeln (Zoom z)
// Kartenstil: "voyager" = hell/freundlich mit dezenten Farben (Parks, Wasser),
// "light_all" = minimal hellgrau, "dark_all" = dunkel. Alle OHNE Laeden/POIs.
const TILE_URL = (style, z, x, y) => `https://basemaps.cartocdn.com/rastertiles/${style}/${z}/${x}/${y}@2x.png`;

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
export async function buildMapLayer({ region, route, width, height, accent = '#19C98F', endColor = '#F0574B', style = 'voyager' }) {
  const isDark = style === 'dark_all';
  // Zoom so waehlen, dass der Ausschnitt die Breite fuellt (Skalierung s in [1, 2) ->
  // @2x-Kacheln bleiben scharf und es sind hoechstens ~6x5 Kacheln zu laden).
  const zf = Math.log2((width * 360) / (TILE_WORLD * region.longitudeDelta));
  const z = Math.max(3, Math.min(18, Math.floor(zf)));
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
        const res = await fetch(TILE_URL(style, z, wx, ty), { headers: { 'User-Agent': 'FitAvo/1.2 (Fitness-App; Lauf-Teilen-Bild)' } });
        if (!res.ok) throw new Error(`tile ${z}/${wx}/${ty}: ${res.status}`);
        const b64 = b64FromBuffer(await res.arrayBuffer());
        const px = (tx * TILE_WORLD - viewLeft) * s;
        const py = (ty * TILE_WORLD - viewTop) * s;
        const size = TILE_WORLD * s;
        return `<image x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" xlink:href="data:image/png;base64,${b64}"/>`;
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
    const casing = isDark ? '#06251B' : '#0A5C41'; // dunkle Kontur, damit die Linie auf der Karte "sitzt"
    routeSvg = `
  <polyline points="${pts.join(' ')}" fill="none" stroke="${casing}" stroke-opacity="0.45" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${first[0]}" cy="${first[1]}" r="13" fill="${accent}" stroke="#FFFFFF" stroke-width="5"/>
  <circle cx="${last[0]}" cy="${last[1]}" r="13" fill="${endColor}" stroke="#FFFFFF" stroke-width="5"/>`;
  }

  // Pflicht-Attribution fuer OSM/CARTO-Kartenmaterial, dezent unten links.
  const attrFill = isDark ? '#FFFFFF' : '#3E4A55';
  const attribution = `<text x="18" y="${height - 16}" font-family="Inter" font-size="17" font-weight="500" fill="${attrFill}" fill-opacity="0.6">© OpenStreetMap · © CARTO</text>`;

  return `<g clip-path="url(#mapclip)">
  ${tileSvg}
  ${routeSvg}
  ${attribution}
  </g>`;
}
