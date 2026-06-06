// Gesundheits-Anbindung (Schritte) – plattformuebergreifende Schnittstelle.
// Android: Health Connect (react-native-health-connect).
// iOS: spaeter via Apple HealthKit (braucht Apple-Developer-Account) -> aktuell "nicht verfuegbar".
// Funktioniert NUR im echten Build, nicht in Expo Go.
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

export function healthSupported(): boolean {
  return !!hc();
}

// Ist Health Connect auf dem Geraet verfuegbar (App installiert / im System vorhanden)?
export async function healthAvailable(): Promise<boolean> {
  const HC = hc();
  if (!HC) return false;
  try {
    const status = await HC.getSdkStatus();
    return status === HC.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// Berechtigung "Schritte lesen" anfragen. Gibt true zurueck, wenn erteilt.
export async function requestStepsPermission(): Promise<boolean> {
  const HC = hc();
  if (!HC) return false;
  try {
    await HC.initialize();
    const granted = await HC.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    return Array.isArray(granted) && granted.length > 0;
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
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

// Health-Connect-Einstellungen oeffnen (z. B. zum Installieren/Verwalten).
export async function openHealthSettings(): Promise<void> {
  const HC = hc();
  if (!HC) return;
  try {
    await HC.openHealthConnectSettings();
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
