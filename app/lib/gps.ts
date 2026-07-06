// GPS-Aktivitaeten (Laufen/Rad/Gehen) - REINE Logik: Distanz, Tempo, Kalorien, Formatierung.
// Kein Native-/UI-Code -> unit-testbar. Die Tracking-UI nutzt diese Funktionen + expo-location.

export type GpsPoint = { lat: number; lng: number; t: number }; // t = ms seit Epoch
export type GpsActivityKey = 'running' | 'cycling' | 'walking';

// MET-Werte (grob, Compendium of Physical Activities) fuer die Kalorienschaetzung. icon = Ionicons.
export const GPS_ACTIVITIES: { key: GpsActivityKey; met: number; icon: string }[] = [
  { key: 'running', met: 9.8, icon: 'walk' },
  { key: 'cycling', met: 7.5, icon: 'bicycle' },
  { key: 'walking', met: 3.5, icon: 'footsteps' },
];

export function gpsActivityByKey(key: string) {
  return GPS_ACTIVITIES.find((x) => x.key === key);
}

const EARTH_M = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

// Haversine-Distanz zwischen zwei Koordinaten in Metern.
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Gesamtstrecke einer Punktliste in Metern. Mikro-Sprünge (<3 m = GPS-Rauschen im Stand) ignorieren.
export function routeDistanceM(points: GpsPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = haversineM(points[i - 1], points[i]);
    if (seg >= 3) d += seg;
  }
  return d;
}

// Tempo in Sekunden pro km (0, wenn keine sinnvolle Strecke).
export function paceSecPerKm(distanceM: number, durationS: number): number {
  if (distanceM < 1 || durationS <= 0) return 0;
  return durationS / (distanceM / 1000);
}

// Tempo als "5:30" (min:sek pro km). 0/ungueltig -> "–".
export function formatPace(secPerKm: number): string {
  if (!secPerKm || !isFinite(secPerKm)) return '–';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Dauer als "MM:SS" oder "H:MM:SS".
export function formatDuration(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Distanz "5,20 km" (deutsche Kommaschreibweise) oder "820 m".
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(2).replace('.', ',')} km`;
}

// Kalorien per MET: kcal = MET * Koerpergewicht(kg) * Dauer(Stunden).
export function gpsKcal(met: number, weightKg: number, durationS: number): number {
  if (!met || !weightKg || durationS <= 0) return 0;
  return Math.round(met * weightKg * (durationS / 3600));
}

// Karten-Region fuer den Teilen-Schnappschuss: umschliesst die Route mit Rand und ist auf das
// Seitenverhaeltnis des Bild-Ausschnitts (Breite/Hoehe, z. B. 360/300) korrigiert. So passt der
// Snapshotter nichts mehr an -> die Route liegt mittig und komplett im Bild.
export function shareRegion(points: GpsPoint[], aspectWoverH = 360 / 300) {
  if (points.length === 0) return null;
  let minLat = points[0].lat, maxLat = points[0].lat, minLng = points[0].lng, maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  }
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.max(0.2, Math.cos(rad(midLat))); // Laengengrade sind um cos(Breite) gestaucht
  // 45 % Rand um die Route; Mindestgroesse ~250 m, damit Mini-Strecken nicht extrem gezoomt sind.
  const dLat = Math.max(0.0022, (maxLat - minLat) * 1.45);
  const dLng = Math.max(0.0022, (maxLng - minLng) * 1.45);
  // Auf das Ziel-Seitenverhaeltnis aufweiten (nie beschneiden, nur vergroessern).
  let latDelta = dLat;
  let lngDelta = latDelta * aspectWoverH / cos;
  if (lngDelta < dLng) { lngDelta = dLng; latDelta = lngDelta * cos / aspectWoverH; }
  return { latitude: midLat, longitude: (minLng + maxLng) / 2, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}
