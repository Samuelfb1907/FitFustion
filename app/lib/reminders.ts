// Erinnerungen (lokale Benachrichtigungen). Funktioniert in einem Development-Build;
// in Expo Go werden Benachrichtigungen (v. a. iOS) nicht zugestellt – Code ist aber startklar.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReminderPrefs = { enabled: boolean; water: boolean; training: boolean; trainingHour: number };

const KEY = 'fitfusion.reminders';
const DEFAULT: ReminderPrefs = { enabled: false, water: true, training: true, trainingHour: 18 };
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
  } catch {
    // In Expo Go ggf. nicht unterstuetzt – im Dev-Build aktiv.
  }
}
