// In-App-Bewertungsabfrage: bittet nach einem positiven Moment (z. B. nach einem
// abgeschlossenen Training) sparsam um eine Store-Bewertung. Apple/Google begrenzen
// die native Abfrage ohnehin; wir halten uns zusaetzlich an strenge eigene Regeln:
// erst ab N guten Momenten, hoechstens 1x alle ~120 Tage. Schlaegt nie fehl (try/catch),
// damit eine Bewertungsabfrage niemals einen Ablauf in der App stoert.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

const KEY_COUNT = 'fitavo.review.goodMoments';
const KEY_LAST = 'fitavo.review.lastAskedAt';
const MIN_GOOD_MOMENTS = 3; // erst ab dem 3. positiven Moment fragen
const MIN_DAYS_BETWEEN = 120; // danach hoechstens alle 120 Tage erneut
const ANDROID_PKG = 'com.samuelfb1907.fitavo';

// Einen positiven Moment zaehlen (z. B. Training beendet). Ab MIN_GOOD_MOMENTS wird
// – falls erlaubt – die native Bewertungsabfrage gezeigt.
export async function registerGoodMoment(): Promise<void> {
  try {
    const n = (parseInt((await AsyncStorage.getItem(KEY_COUNT)) ?? '0', 10) || 0) + 1;
    await AsyncStorage.setItem(KEY_COUNT, String(n));
    if (n >= MIN_GOOD_MOMENTS) await maybeAsk();
  } catch {}
}

async function maybeAsk(): Promise<void> {
  try {
    const lastStr = await AsyncStorage.getItem(KEY_LAST);
    if (lastStr) {
      const last = Date.parse(lastStr);
      if (isFinite(last) && Date.now() - last < MIN_DAYS_BETWEEN * 86400000) return;
    }
    if (!(await StoreReview.isAvailableAsync())) return;
    // Zeitstempel VOR dem Aufruf setzen: Auch wenn das OS die Abfrage unterdrueckt,
    // fragen wir dann nicht beim naechsten guten Moment sofort wieder.
    await AsyncStorage.setItem(KEY_LAST, new Date().toISOString());
    await StoreReview.requestReview();
  } catch {}
}

// Manuell aus den Einstellungen: native Abfrage; sonst (Android) die Store-Seite oeffnen.
export async function openStoreReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return;
    }
  } catch {}
  if (Platform.OS === 'android') {
    Linking.openURL(`https://play.google.com/store/apps/details?id=${ANDROID_PKG}`).catch(() => {});
  }
}
