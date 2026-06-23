// Gamification-Logik: XP, Level, Streak und Erfolge.
// Reine Funktionen (kein UI/DB) – berechnet aus vorhandenen Aktivitätsdaten.

export type GameStats = {
  sessions: number;  // Anzahl Trainings-Sessions
  sets: number;      // Anzahl mitgeschriebener Sätze
  foodLogs: number;  // Anzahl Tracker-Einträge
  streak: number;    // aktuelle Tage-in-Folge
  goalSet: boolean;  // hat ein aktives Ziel
};

export const XP_PER_LEVEL = 250;

// XP aus Aktivität
export function computeXp(s: GameStats): number {
  return s.sessions * 50 + s.sets * 5 + s.foodLogs * 3;
}

export function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp % XP_PER_LEVEL;
  return { level, intoLevel, perLevel: XP_PER_LEVEL, progress: intoLevel / XP_PER_LEVEL };
}

// Aktuelle Streak aus einer Liste von Aktiv-Tagen (YYYY-MM-DD).
// 1 Tag Karenz: Wenn heute noch nichts gemacht wurde, zählt ab gestern weiter.
export function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(fmt(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(fmt(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Laengste je erreichte Streak (laengster zusammenhaengender Tage-Block) aus Aktiv-Tagen.
export function computeLongestStreak(dates: string[]): number {
  const set = new Set(dates);
  if (set.size === 0) return 0;
  const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let longest = 0;
  for (const d of set) {
    const prev = parse(d); prev.setDate(prev.getDate() - 1);
    if (set.has(fmt(prev))) continue; // nur an Block-Anfaengen zaehlen
    let run = 0; const cur = parse(d);
    while (set.has(fmt(cur))) { run++; cur.setDate(cur.getDate() + 1); }
    if (run > longest) longest = run;
  }
  return longest;
}

export type Achievement = {
  key: string;
  name: string;
  icon: string;
  description: string;
  earned: (s: GameStats, level: number) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { key: 'first_workout', name: 'Erstes Workout', icon: '🏋️', description: 'Schließe dein erstes Training ab.', earned: (s) => s.sessions >= 1 },
  { key: 'workouts_10', name: '10 Trainings', icon: '💪', description: '10 Trainingseinheiten absolviert.', earned: (s) => s.sessions >= 10 },
  { key: 'workouts_25', name: '25 Trainings', icon: '🔥', description: '25 Trainingseinheiten absolviert.', earned: (s) => s.sessions >= 25 },
  { key: 'sets_50', name: '50 Sätze', icon: '🧱', description: '50 Sätze mitgeschrieben.', earned: (s) => s.sets >= 50 },
  { key: 'sets_200', name: '200 Sätze', icon: '🏗️', description: '200 Sätze mitgeschrieben.', earned: (s) => s.sets >= 200 },
  { key: 'streak_3', name: '3-Tage-Streak', icon: '✨', description: '3 Tage in Folge aktiv.', earned: (s) => s.streak >= 3 },
  { key: 'streak_7', name: '7-Tage-Streak', icon: '🔥', description: '7 Tage in Folge aktiv.', earned: (s) => s.streak >= 7 },
  { key: 'streak_30', name: '30-Tage-Streak', icon: '🏆', description: '30 Tage in Folge aktiv.', earned: (s) => s.streak >= 30 },
  { key: 'tracker_first', name: 'Erster Eintrag', icon: '🍎', description: 'Erste Zutat im Tracker erfasst.', earned: (s) => s.foodLogs >= 1 },
  { key: 'tracker_20', name: '20 Tracker-Logs', icon: '📒', description: '20 Zutaten getrackt.', earned: (s) => s.foodLogs >= 20 },
  { key: 'goal_set', name: 'Ziel gesetzt', icon: '🎯', description: 'Ein Fitnessziel festgelegt.', earned: (s) => s.goalSet },
  { key: 'level_5', name: 'Level 5', icon: '⭐', description: 'Erreiche Level 5.', earned: (_s, level) => level >= 5 },
];
