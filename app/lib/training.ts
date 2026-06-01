// Gemeinsame Trainings-Konstanten – genutzt von TrainingScreen, PlanScreen und ExerciseDetail.
// (Vorher waren diese in jedem Screen einzeln dupliziert -> hier eine einzige Quelle.)

// Anzeige-Labels
export const DIFF_LABELS: Record<string, string> = {
  beginner: 'Anfänger', intermediate: 'Fortgeschritten', advanced: 'Profi',
};
export const EQUIP_LABELS: Record<string, string> = {
  barbell: 'Langhantel', dumbbell: 'Kurzhantel', machine: 'Maschine', cable: 'Kabelzug',
  bodyweight: 'Körpergewicht', none: 'Kein Gerät', other: 'Sonstiges',
};

// Welche Schwierigkeitsgrade je Erfahrungs-Level erlaubt sind
export const ALLOWED_DIFF: Record<string, string[]> = {
  beginner: ['beginner'], some: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'], pro: ['beginner', 'intermediate', 'advanced'],
};

// Welches Equipment je Trainingsumgebung erlaubt ist
export const ALLOWED_EQUIP: Record<string, string[]> = {
  gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'none', 'other'],
  home_gym: ['dumbbell', 'bodyweight', 'none', 'other'],
  no_equipment: ['bodyweight', 'none'],
};
