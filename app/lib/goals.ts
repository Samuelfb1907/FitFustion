// Tagesziele & woechentliche Challenges – rein aus vorhandenen Daten berechnet.
export type Goal = { key: string; icon: string; label: string; done: boolean; progress: number; detail: string };

export function dailyGoals(i: {
  trainedToday: boolean;
  trackedToday: boolean;
  eatenKcal: number;
  targetKcal: number;
  eatenProtein: number;
  targetProtein: number;
}): Goal[] {
  const kcalPct = i.targetKcal ? i.eatenKcal / i.targetKcal : 0;
  const kcalDone = kcalPct >= 0.8 && kcalPct <= 1.1; // im Zielbereich
  const protPct = i.targetProtein ? i.eatenProtein / i.targetProtein : 0;
  // label ist ein i18n-Schluessel - Anzeige im Screen via t(g.label).
  return [
    { key: 'train', icon: '🏋️', label: 'home.dgoal.train', done: i.trainedToday, progress: i.trainedToday ? 1 : 0, detail: i.trainedToday ? 'Erledigt' : 'Noch kein Training heute' },
    { key: 'track', icon: '🍽️', label: 'home.dgoal.track', done: i.trackedToday, progress: i.trackedToday ? 1 : 0, detail: i.trackedToday ? 'Erledigt' : 'Noch nichts im Tagebuch' },
    { key: 'kcal', icon: '🔥', label: 'home.dgoal.kcal', done: kcalDone, progress: Math.min(1, kcalPct), detail: `${i.eatenKcal} / ${i.targetKcal} kcal` },
    { key: 'protein', icon: '💪', label: 'home.dgoal.protein', done: protPct >= 1, progress: Math.min(1, protPct), detail: `${i.eatenProtein} / ${i.targetProtein} g Protein` },
  ];
}

export function weeklyChallenges(i: {
  sessionsThisWeek: number;
  trackedDaysThisWeek: number;
  streak: number;
}): Goal[] {
  const mk = (key: string, icon: string, label: string, val: number, target: number, unit: string): Goal => ({
    key, icon, label, done: val >= target, progress: target ? Math.min(1, val / target) : 0,
    detail: `${Math.min(val, target)} / ${target} ${unit}`,
  });
  return [
    mk('w_train', '🏋️', '3 Trainings diese Woche', i.sessionsThisWeek, 3, 'Trainings'),
    mk('w_track', '🍽️', 'An 5 Tagen Essen tracken', i.trackedDaysThisWeek, 5, 'Tage'),
    mk('w_streak', '🔥', '7-Tage-Streak halten', i.streak, 7, 'Tage'),
  ];
}
