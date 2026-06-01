// Gemeinsame Datums-Helfer.
// WICHTIG: Server-Timestamps (timestamptz = UTC) IMMER über localDateStr() in die lokale
// Zeitzone umrechnen, bevor sie mit lokal gebildeten Datums-Strings verglichen werden –
// sonst zählen z. B. Trainings kurz nach Mitternacht für den Vortag.
export function todayStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO/UTC-Timestamp -> lokales Kalenderdatum "YYYY-MM-DD"
export function localDateStr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 10);
  return todayStr(d);
}

export function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// "YYYY-MM-DD" oder ISO -> "TT.MM"
export function ddmm(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
