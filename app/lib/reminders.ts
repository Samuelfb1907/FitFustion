// Erinnerungen (lokale Benachrichtigungen). Funktioniert in einem Development-Build;
// in Expo Go werden Benachrichtigungen (v. a. iOS) nicht zugestellt – Code ist aber startklar.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOTIVATION_QUOTES } from './quotes';

export type ReminderPrefs = { enabled: boolean; water: boolean; training: boolean; trainingHour: number; motivation: boolean; motivationHour: number; streakRisk: boolean };

const KEY = 'fitavo.reminders';
const DEFAULT: ReminderPrefs = { enabled: false, water: true, training: true, trainingHour: 18, motivation: true, motivationHour: 8, streakRisk: true };
const WATER_TIMES: [number, number][] = [[10, 0], [13, 0], [16, 0], [19, 0]];
const WINBACK_IDS = ['fitavo.winback.day3', 'fitavo.winback.day7'] as const;
const STREAK_ID = 'fitavo.streakrisk';
const STREAK_HOUR = 19, STREAK_MIN = 30; // abends, leicht versetzt zur Wasser-Erinnerung

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
      const DAYS = 43; // unter iOS-Limit (64) bleiben, kombiniert mit Wasser/Training + 2 Win-back-Pushes
      // Startindex deterministisch pro Tag -> mehrfacher App-Start am selben Tag
      // erzeugt denselben Plan (kein Neu-Wuerfeln, keine doppelten/verlorenen Termine).
      const start = Math.floor(Date.now() / 86400000) % MOTIVATION_QUOTES.length;
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

export async function scheduleWinback(): Promise<void> {
  try {
    // Erst evtl. noch offene Win-back-Termine entfernen, dann neu planen.
    await cancelWinback();
    const plan: [number, string, string][] = [
      [3, '👋 Wir vermissen dich!', 'Schon 3 Tage kein Training getrackt. Komm zurück und halte dran – dein Ich von morgen dankt dir.'],
      [7, '💪 Zeit für ein Comeback', 'Eine Woche Pause ist okay. Starte heute klein – eine Einheit reicht, um wieder reinzukommen.'],
    ];
    const now = new Date();
    for (let i = 0; i < plan.length; i++) {
      const [days, title, body] = plan[i];
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      d.setHours(11, 0, 0, 0);
      if (d.getTime() <= Date.now() + 60000) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: WINBACK_IDS[i],
        content: { title, body },
        trigger: { type: 'date', date: d } as any,
      });
    }
  } catch {
    // In Expo Go ggf. nicht unterstuetzt – im Dev-Build aktiv.
  }
}

export async function cancelWinback(): Promise<void> {
  try {
    for (const id of WINBACK_IDS) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  } catch {}
}

// Streak-Schutz-Erinnerung (#46): EINE dezente Abend-Benachrichtigung, die NUR feuert,
// wenn eine echte Serie auf dem Spiel steht (>= 3 Tage UND heute noch nichts gemacht).
// Wird bei jedem Home-Laden mit dem aktuellen Stand neu gesetzt -> wer heute aktiv war,
// kriegt nichts. Abschaltbar (prefs.streakRisk) und an den Master-Schalter gekoppelt.
export async function syncStreakReminder(streak: number, activeToday: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_ID).catch(() => {});
    const p = await loadReminderPrefs();
    if (!p.enabled || !p.streakRisk) return;
    if (streak < 3 || activeToday) return; // keine Serie in Gefahr -> still bleiben
    const fire = new Date();
    fire.setHours(STREAK_HOUR, STREAK_MIN, 0, 0);
    if (fire.getTime() <= Date.now() + 60000) return; // Abend-Fenster heute schon vorbei
    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_ID,
      content: {
        title: '🔥 Deine Serie ist in Gefahr!',
        body: `Du bist bei ${streak} Tagen in Folge. Eine Einheit oder ein Eintrag heute hält sie am Leben.`,
      },
      trigger: { type: 'date', date: fire } as any,
    });
  } catch {
    // In Expo Go ggf. nicht unterstuetzt – im Dev-Build aktiv.
  }
}
