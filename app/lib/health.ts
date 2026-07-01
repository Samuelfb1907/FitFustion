// Gesundheits-Anbindung (Schritte) – plattformuebergreifende Schnittstelle.
// Android: Health Connect (react-native-health-connect) – Schritte + gemessene aktive Kalorien.
// iOS: eingebauter Schrittzaehler via expo-sensors (Core Motion / "Bewegung & Fitness") –
//   nur Schritte; die Kalorien werden daraus geschaetzt (keine gemessenen aktiven Kalorien).
// Beides braucht einen echten Build (Health Connect laeuft nicht in Expo Go).
import { Platform } from 'react-native';

// react-native-health-connect ist Android-only und im echten Build vorhanden.
// LAZY + try/catch laden, damit es selbst in Expo Go (Modul fehlt) NICHT abstuerzt.
let _hc: any = null;
let _hcTried = false;
function hc(): any {
  if (Platform.OS !== 'android') return null;
  if (!_hcTried) {
    _hcTried = true;
    try {
      _hc = require('react-native-health-connect');
    } catch {
      _hc = null;
    }
  }
  return _hc;
}

// iOS: eingebauter Schrittzaehler (Core Motion / "Bewegung & Fitness") via expo-sensors.
// LAZY laden, damit nichts abstuerzt, falls das Modul fehlt.
let _ped: any = null;
let _pedTried = false;
function ped(): any {
  if (Platform.OS !== 'ios') return null;
  if (!_pedTried) {
    _pedTried = true;
    try {
      _ped = require('expo-sensors').Pedometer;
    } catch {
      _ped = null;
    }
  }
  return _ped;
}

export function healthSupported(): boolean {
  if (Platform.OS === 'ios') return !!ped();
  return !!hc();
}

// Schutz gegen haengende native Aufrufe: nach `ms` mit `fallback` aufloesen,
// damit die UI nie ewig im "busy"-Zustand stehenbleibt (sonst "nichts passiert").
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const id = setTimeout(() => { if (!settled) { settled = true; resolve(fallback); } }, ms);
    p.then(
      (v) => { if (!settled) { settled = true; clearTimeout(id); resolve(v); } },
      () => { if (!settled) { settled = true; clearTimeout(id); resolve(fallback); } },
    );
  });
}

// Ist Health Connect auf dem Geraet verfuegbar (App installiert / im System vorhanden)?
// Mit Timeout: kommt der native Aufruf auf manchen Geraeten nicht zurueck, gilt "nicht verfuegbar".
export async function healthAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const P = ped();
    if (!P) return false;
    try { return await withTimeout(P.isAvailableAsync(), 8000, false); } catch { return false; }
  }
  const HC = hc();
  if (!HC) return false;
  try {
    const status = await withTimeout(HC.getSdkStatus(), 8000, -1);
    return status === HC.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// Berechtigung anfragen: Schritte + aktive Kalorien lesen. Gibt true zurueck, wenn erteilt.
export async function requestHealthPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const P = ped();
    if (!P) return false;
    try {
      const res = await P.requestPermissionsAsync();
      return !!res?.granted;
    } catch { return false; }
  }
  const HC = hc();
  if (!HC) return false;
  try {
    await HC.initialize();
    const granted = await HC.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    return Array.isArray(granted) && granted.length > 0;
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const P = ped();
    if (!P) return false;
    try {
      const res = await P.getPermissionsAsync();
      return !!res?.granted;
    } catch { return false; }
  }
  const HC = hc();
  if (!HC) return false;
  try {
    await HC.initialize();
    const perms = await HC.getGrantedPermissions();
    return Array.isArray(perms) && perms.some((p: any) => p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

// Heutige Schritte (Summe aller Quellen ab Mitternacht).
export async function getTodaySteps(): Promise<number> {
  if (Platform.OS === 'ios') {
    const P = ped();
    if (!P) return 0;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const res = await P.getStepCountAsync(start, new Date());
      return Math.max(0, Math.round(Number(res?.steps) || 0));
    } catch { return 0; }
  }
  const HC = hc();
  if (!HC) return 0;
  try {
    await HC.initialize();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const res = await HC.readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() },
    });
    const recs = res?.records ?? res?.result ?? (Array.isArray(res) ? res : []);
    return (recs as any[]).reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0);
  } catch {
    return 0;
  }
}

// Heute aktiv verbrannte Kalorien (z. B. von der Smartwatch gemessen) in kcal.
export async function getTodayActiveCalories(): Promise<number> {
  // iOS-Schrittzaehler liefert keine aktiven Kalorien -> aus Schritten schaetzen (s. getTodayActivity).
  if (Platform.OS === 'ios') return 0;
  const HC = hc();
  if (!HC) return 0;
  try {
    await HC.initialize();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const res = await HC.readRecords('ActiveCaloriesBurned', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() },
    });
    const recs = res?.records ?? res?.result ?? (Array.isArray(res) ? res : []);
    const kcal = (recs as any[]).reduce((sum: number, r: any) => sum + (Number(r?.energy?.inKilocalories) || 0), 0);
    return Math.round(kcal);
  } catch {
    return 0;
  }
}

// Heutige Aktivitaet: GEMESSENE aktive Kalorien bevorzugen (Uhr), sonst aus Schritten schaetzen.
// So zaehlen wir nie doppelt (entweder Messwert ODER Schaetzung).
export async function getTodayActivity(weightKg: number): Promise<{ steps: number; kcal: number; measured: boolean }> {
  const steps = await getTodaySteps();
  const active = await getTodayActiveCalories();
  if (active > 0) return { steps, kcal: active, measured: true };
  return { steps, kcal: stepsKcal(steps, weightKg), measured: false };
}

// Schritte fuer EINEN bestimmten Tag (daysAgo: 0 = heute, 1 = gestern, ...).
// iOS Core Motion / Health Connect halten typischerweise ~7 Tage Verlauf vor;
// fuer aeltere/ohne Daten kommt 0 zurueck.
export async function getStepsForDay(daysAgo: number): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const until = daysAgo === 0 ? new Date() : end; // heute nur bis jetzt zaehlen
  if (Platform.OS === 'ios') {
    const P = ped();
    if (!P) return 0;
    try {
      const res = await P.getStepCountAsync(start, until);
      return Math.max(0, Math.round(Number(res?.steps) || 0));
    } catch { return 0; }
  }
  const HC = hc();
  if (!HC) return 0;
  try {
    await HC.initialize();
    const res = await HC.readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: until.toISOString() },
    });
    const recs = res?.records ?? res?.result ?? (Array.isArray(res) ? res : []);
    return (recs as any[]).reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0);
  } catch { return 0; }
}

// Schritte der letzten `days` Tage (Index = Tage zurueck: [0]=heute ... [days-1]).
export async function getStepsLastDays(days: number): Promise<number[]> {
  return Promise.all(Array.from({ length: days }, (_, i) => getStepsForDay(i)));
}

// Health-Connect-Einstellungen oeffnen (z. B. zum Installieren/Verwalten).
export async function openHealthSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      const { Linking } = require('react-native');
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
    return;
  }
  const HC = hc();
  if (!HC) return;
  try {
    await HC.openHealthConnectSettings();
  } catch {
    /* ignore */
  }
}

// Play-Store-Seite von Health Connect oeffnen (zum Installieren/Aktualisieren) - nur Android.
// Wird genutzt, wenn Health Connect noch gar nicht verfuegbar ist (openHealthConnectSettings
// kann dann nichts oeffnen).
export async function openHealthConnectInstall(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { Linking } = require('react-native');
    await Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata');
  } catch {
    /* ignore */
  }
}

// Grobe kcal-Schaetzung aus Schritten: ~0.04 kcal/Schritt bei 70 kg, skaliert mit Gewicht.
// Bewusst konservativ – nur eine Orientierung (wie der Trainingsbonus).
export function stepsKcal(steps: number, weightKg: number): number {
  if (!steps || !weightKg) return 0;
  return Math.round(steps * 0.04 * (weightKg / 70));
}
