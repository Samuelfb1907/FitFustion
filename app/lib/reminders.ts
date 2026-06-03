// Erinnerungen (lokale Benachrichtigungen). Funktioniert in einem Development-Build;
// in Expo Go werden Benachrichtigungen (v. a. iOS) nicht zugestellt – Code ist aber startklar.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTIVATION_QUOTES } from './quotes';

export type ReminderPrefs = { enabled: boolean; water: boolean; training: boolean; trainingHour: number; motivation: boolean; motivationHour: number };

const KEY = 'fitfusion.reminders';
const DEFAULT: ReminderPrefs = { enabled: false, water: true, training: true, trainingHour: 18, motivation: true, motivationHour: 8 };
const WATER_TIMES: [number, number][] = [[10, 0], [13, 0], [16, 0], [19, 0]];

// Hinweise auch im Vordergrund anzeigen (greift im Dev-Build)
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? { ...DEFAULT, ...JSON.parse(s) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export async function saveReminderPrefs(p: ReminderPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
}

export async function ensurePermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

export async function applyReminders(p: ReminderPrefs): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!p.enabled) return;
    const daily = (hour: number, minute: number, title: string, body: string) =>
      Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: { type: 'daily', hour, minute } as any,
      });
    if (p.water) {
      for (const [h, m] of WATER_TIMES) await daily(h, m, '💧 Zeit zu trinken!', 'Trink ein Glas Wasser – komm deinem Tagesziel näher.');
    }
    if (p.training) await daily(p.trainingHour, 0, '💪 Trainingszeit!', 'Zeit für dein Workout. Leg los!');

    // Taegliche Motivation: einzelne Benachrichtigungen fuer die naechsten Wochen
    // (rotierende Sprueche, zufaelliger Startpunkt). Wird bei jedem App-Start neu aufgefuellt.
    if (p.motivation && MOTIVATION_QUOTES.length > 0) {
      const DAYS = 45; // unter iOS-Limit (64) bleiben, kombiniert mit Wasser/Training
      const start = Math.floor(Math.random() * MOTIVATION_QUOTES.length);
      const now = new Date();
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        d.setHours(p.motivationHour, 0, 0, 0);
        if (d.getTime() <= Date.now() + 60000) continue; // heutige Uhrzeit schon vorbei
        const quote = MOTIVATION_QUOTES[(start + i) % MOTIVATION_QUOTES.length];
        await Notifications.scheduleNotificationAsync({
          content: { title: '🔥 Deine tägliche Motivation', body: quote },
          trigger: { type: 'date', date: d } as any,
        });
      }
    }
  } catch {
    // In Expo Go ggf. nicht unterstuetzt – im Dev-Build aktiv.
  }
}
