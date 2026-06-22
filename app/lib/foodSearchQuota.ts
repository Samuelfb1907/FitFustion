// Gratis-Kontingent fuer die Open-Food-Facts-Datenbanksuche im FoodTracker.
// Gratis-Nutzer duerfen pro Kalendertag eine kleine Zahl echter Datenbank-Suchen,
// danach erscheint der Premium-Upsell. Der Zaehler liegt lokal in AsyncStorage und
// haengt am heutigen Datum -> am Folgetag automatisch wieder bei 0 (kein Cron noetig).
// Reine JS-Logik, in Expo Go nutzbar.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayStr } from './date';

// Wie viele Datenbank-Suchen Gratis-Nutzer pro Tag frei haben.
export const FREE_FOOD_SEARCHES_PER_DAY = 3;

const KEY = 'fitavo.foodSearchQuota';

type Stored = { date: string; count: number };

async function read(): Promise<Stored> {
  const today = todayStr();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Stored>;
      if (parsed && parsed.date === today && typeof parsed.count === 'number' && parsed.count >= 0) {
        return { date: today, count: parsed.count };
      }
    }
  } catch {}
  // Kein Eintrag, anderer Tag oder kaputt -> heute bei 0 starten.
  return { date: today, count: 0 };
}

// Heutiger Verbrauch (0..N). Liest, ohne zu erhoehen.
export async function loadFoodSearchCount(): Promise<number> {
  return (await read()).count;
}

// Verbrauch um 1 erhoehen und neuen Stand zurueckgeben. Setzt automatisch auf
// das heutige Datum (verwirft den Vortags-Stand).
export async function bumpFoodSearchCount(): Promise<number> {
  const cur = await read();
  const next: Stored = { date: cur.date, count: cur.count + 1 };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next.count;
}

// Noch freie Suchen heute (>= 0).
export async function remainingFoodSearches(): Promise<number> {
  const used = await loadFoodSearchCount();
  return Math.max(0, FREE_FOOD_SEARCHES_PER_DAY - used);
}
