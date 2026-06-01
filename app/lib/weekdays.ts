// Wochentage (0 = Montag ... 6 = Sonntag), gemeinsam genutzt von Plan- & Start-Screen.
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// JS getDay(): 0 = Sonntag ... 6 = Samstag  ->  unsere Konvention 0 = Montag ... 6 = Sonntag
export function todayWeekday(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7;
}
