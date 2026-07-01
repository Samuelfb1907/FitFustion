// Gesundheits-Anbindung (Schritte + aktive Kalorien) – plattformuebergreifende Schnittstelle.
// Android: Health Connect (react-native-health-connect).
// iOS: BEVORZUGT Apple Health / HealthKit (react-native-health) – bekommt damit auch die
//   Daten von Dritt-Armbaendern (Fitbit/Garmin/Polar/…), die nach Apple Health syncen, inkl.
//   GEMESSENER aktiver Kalorien. FALLBACK: eingebauter Schrittzaehler (expo-sensors Pedometer),
//   falls HealthKit (noch) nicht im Build ist oder nicht freigegeben wurde -> keine Regression.
// Alles braucht einen echten Build (weder Health Connect noch HealthKit laufen in Expo Go).
import { Platform } from 'react-native';

// --- Android: Health Connect (lazy + try/catch, damit Expo Go nicht abstuerzt) ---
let _hc: any = null;
let _hcTried = false;
function hc(): any {
  if (Platform.OS !== 'android') return null;
  if (!_hcTried) {
    _hcTried = true;
    try { _hc = require('react-native-health-connect'); } catch { _hc = null; }
  }
  return _hc;
}

// --- iOS: Apple HealthKit (lazy). Nur gueltig, wenn das native Modul verlinkt ist
// (initHealthKit vorhanden) – sonst null -> Fallback auf den Schrittzaehler. ---
let _hk: any = null;
let _hkTried = false;
let _hkInited = false;
function hk(): any {
  if (Platform.OS !== 'ios') return null;
  if (!_hkTried) {
    _hkTried = true;
    try {
      const m = require('react-native-health');
      const mod = m?.default ?? m;
      _hk = mod && typeof mod.initHealthKit === 'function' ? mod : null;
    } catch { _hk = null; }
  }
  return _hk;
}
function hkPerms(): any {
  const HK = hk();
  const P = HK?.Constants?.Permissions ?? {};
  return { permissions: { read: [P.Steps, P.ActiveEnergyBurned].filter(Boolean), write: [] } };
}
// Einmalig initialisieren (zeigt beim ERSTEN Mal die Apple-Health-Freigabe; danach still).
function hkInit(): Promise<boolean> {
  const HK = hk();
  if (!HK) return Promise.resolve(false);
  if (_hkInited) return Promise.resolve(true);
  return new Promise((resolve) => {
    try { HK.initHealthKit(hkPerms(), (err: string) => { _hkInited = !err; resolve(!err); }); }
    catch { resolve(false); }
  });
}
function hkIsAvailable(): Promise<boolean> {
  const HK = hk();
  if (!HK) return Promise.resolve(false);
  if (typeof HK.isAvailable !== 'function') return Promise.resolve(true);
  return new Promise((resolve) => {
    try { HK.isAvailable((err: any, available: boolean) => resolve(!err && !!available)); }
    catch { resolve(false); }
  });
}
// Schritte-Summe fuer einen Zeitraum (Tages-Buckets addiert). null = nicht verfuegbar/Fehler.
async function hkSteps(start: Date, end: Date): Promise<number | null> {
  const HK = hk();
  if (!HK || !(await hkInit())) return null;
  return new Promise((resolve) => {
    try {
      HK.getDailyStepCountSamples(
        { startDate: start.toISOString(), endDate: end.toISOString(), includeManuallyAdded: true },
        (err: string, res: any) => {
          if (err) return resolve(null);
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          resolve(arr.reduce((s: number, r: any) => s + (Number(r?.value) || 0), 0));
        },
      );
    } catch { resolve(null); }
  });
}
// Gemessene aktive Kalorien fuer einen Zeitraum. null = nicht verfuegbar/Fehler.
async function hkActiveCalories(start: Date, end: Date): Promise<number | null> {
  const HK = hk();
  if (!HK || !(await hkInit())) return null;
  return new Promise((resolve) => {
    try {
      HK.getActiveEnergyBurned(
        { startDate: start.toISOString(), endDate: end.toISOString(), includeManuallyAdded: true },
        (err: string, res: any) => {
          if (err) return resolve(null);
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          resolve(Math.round(arr.reduce((s: number, r: any) => s + (Number(r?.value) || 0), 0)));
        },
      );
    } catch { resolve(null); }
  });
}

// iOS-Fallback: eingebauter Schrittzaehler (Core Motion / "Bewegung & Fitness") via expo-sensors.
let _ped: any = null;
let _pedTried = false;
function ped(): any {
  if (Platform.OS !== 'ios') return null;
  if (!_pedTried) {
    _pedTried = true;
    try { _ped = require('expo-sensors').Pedometer; } catch { _ped = null; }
  }
  return _ped;
}

export function healthSupported(): boolean {
  if (Platform.OS === 'ios') return !!hk() || !!ped();
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

// Ist die Gesundheitsquelle auf dem Geraet verfuegbar?
export async function healthAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (hk() && (await withTimeout(hkIsAvailable(), 8000, false))) return true;
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

// Berechtigung anfragen: Schritte + aktive Kalorien lesen. Gibt true zurueck, wenn moeglich.
export async function requestHealthPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    if (hk() && (await hkInit())) return true; // zeigt die Apple-Health-Freigabe
    const P = ped();
    if (!P) return false;
    try { const res = await P.requestPermissionsAsync(); return !!res?.granted; } catch { return false; }
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
    if (hk() && (await hkInit())) return true; // still, kein erneuter Dialog
    const P = ped();
    if (!P) return false;
    try { const res = await P.getPermissionsAsync(); return !!res?.granted; } catch { return false; }
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
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (Platform.OS === 'ios') {
    const v = await hkSteps(start, new Date());
    if (v != null) return Math.max(0, Math.round(v));
    const P = ped();
    if (!P) return 0;
    try {
      const res = await P.getStepCountAsync(start, new Date());
      return Math.max(0, Math.round(Number(res?.steps) || 0));
    } catch { return 0; }
  }
  const HC = hc();
  if (!HC) return 0;
  try {
    await HC.initialize();
    const res = await HC.readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() },
    });
    const recs = res?.records ?? res?.result ?? (Array.isArray(res) ? res : []);
    return (recs as any[]).reduce((sum: number, r: any) => sum + (Number(r.count) || 0), 0);
  } catch {
    return 0;
  }
}

// Heute aktiv verbrannte Kalorien (z. B. von der Uhr/dem Band gemessen) in kcal.
export async function getTodayActiveCalories(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (Platform.OS === 'ios') {
    const v = await hkActiveCalories(start, new Date());
    return v != null ? v : 0; // ohne HealthKit -> aus Schritten schaetzen (s. getTodayActivity)
  }
  const HC = hc();
  if (!HC) return 0;
  try {
    await HC.initialize();
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

// Heutige Aktivitaet: GEMESSENE aktive Kalorien bevorzugen (Uhr/Band), sonst aus Schritten schaetzen.
// So zaehlen wir nie doppelt (entweder Messwert ODER Schaetzung).
export async function getTodayActivity(weightKg: number): Promise<{ steps: number; kcal: number; measured: boolean }> {
  const steps = await getTodaySteps();
  const active = await getTodayActiveCalories();
  if (active > 0) return { steps, kcal: active, measured: true };
  return { steps, kcal: stepsKcal(steps, weightKg), measured: false };
}

// Schritte fuer EINEN bestimmten Tag (daysAgo: 0 = heute, 1 = gestern, ...).
export async function getStepsForDay(daysAgo: number): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const until = daysAgo === 0 ? new Date() : end; // heute nur bis jetzt zaehlen
  if (Platform.OS === 'ios') {
    const v = await hkSteps(start, until);
    if (v != null) return Math.max(0, Math.round(v));
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

// Gesundheits-Einstellungen oeffnen (iOS: App-Einstellungen mit Health-Zugriff; Android: Health Connect).
export async function openHealthSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    try { const { Linking } = require('react-native'); await Linking.openSettings(); } catch { /* ignore */ }
    return;
  }
  const HC = hc();
  if (!HC) return;
  try { await HC.openHealthConnectSettings(); } catch { /* ignore */ }
}

// Play-Store-Seite von Health Connect oeffnen (zum Installieren/Aktualisieren) - nur Android.
export async function openHealthConnectInstall(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { Linking } = require('react-native');
    await Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata');
  } catch { /* ignore */ }
}

// Grobe kcal-Schaetzung aus Schritten: ~0.04 kcal/Schritt bei 70 kg, skaliert mit Gewicht.
// Bewusst konservativ – nur eine Orientierung (wie der Trainingsbonus).
export function stepsKcal(steps: number, weightKg: number): number {
  if (!steps || !weightKg) return 0;
  return Math.round(steps * 0.04 * (weightKg / 70));
}
