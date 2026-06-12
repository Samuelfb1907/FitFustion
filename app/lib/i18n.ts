// Mehrsprachigkeit (i18n) - leichtgewichtig, ohne externe Library.
// Schluessel -> uebersetzter Text. {param} wird interpoliert (z. B. t('x', { n: 3 })).
// NEUE Texte: Schluessel in BEIDE Woerterbuecher (de + en) eintragen. Fehlt ein
// Schluessel auf Englisch, faellt er automatisch auf Deutsch zurueck (statt leer).
export type Lang = 'de' | 'en';
export const LANGS: Lang[] = ['de', 'en'];

type Dict = Record<string, string>;

const de: Dict = {
  // Allgemein
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.back': 'Zurück',
  'common.close': 'Schließen',
  'common.retry': 'Erneut versuchen',
  'common.delete': 'Löschen',

  // Einstellungen
  'settings.title': 'Einstellungen',
  'settings.section.account': 'KONTO',
  'settings.section.appearance': 'DARSTELLUNG',
  'settings.section.language': 'SPRACHE',
  'settings.section.reminders': 'ERINNERUNGEN',
  'settings.section.health': 'GESUNDHEIT',
  'settings.section.data': 'DATEN',
  'settings.section.privacy': 'DATENSCHUTZ (DSGVO)',
  'settings.section.legal': 'RECHTLICHES',
  'settings.section.about': 'ÜBER',
  'settings.language': 'Sprache',
  'settings.logout': 'Abmelden',
};

const en: Dict = {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.retry': 'Try again',
  'common.delete': 'Delete',

  // Settings
  'settings.title': 'Settings',
  'settings.section.account': 'ACCOUNT',
  'settings.section.appearance': 'APPEARANCE',
  'settings.section.language': 'LANGUAGE',
  'settings.section.reminders': 'REMINDERS',
  'settings.section.health': 'HEALTH',
  'settings.section.data': 'DATA',
  'settings.section.privacy': 'PRIVACY (GDPR)',
  'settings.section.legal': 'LEGAL',
  'settings.section.about': 'ABOUT',
  'settings.language': 'Language',
  'settings.logout': 'Log out',
};

const DICTS: Record<Lang, Dict> = { de, en };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = DICTS[lang]?.[key] ?? de[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}
