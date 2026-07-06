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
