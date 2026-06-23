// Mehrsprachigkeit (i18n) - leichtgewichtig, ohne externe Library.
// Schluessel -> uebersetzter Text. {param} wird interpoliert (z. B. t('x', { n: 3 })).
// NEUE Texte: Schluessel in BEIDE Woerterbuecher (de + en) eintragen. Fehlt ein
// Schluessel auf Englisch, faellt er automatisch auf Deutsch zurueck (statt leer).
// Pro-Screen-Woerterbuecher (automatisch je Namespace erzeugt, s. translations/).
import { de as homeDe, en as homeEn } from './translations/home';
import { de as trainingDe, en as trainingEn } from './translations/training';
import { de as planDe, en as planEn } from './translations/plan';
import { de as foodDe, en as foodEn } from './translations/food';
import { de as authDe, en as authEn } from './translations/auth';
import { de as onboardingDe, en as onboardingEn } from './translations/onboarding';
import { de as profileDe, en as profileEn } from './translations/profile';
import { de as progressDe, en as progressEn } from './translations/progress';
import { de as waterDe, en as waterEn } from './translations/water';
import { de as proteinDe, en as proteinEn } from './translations/protein';
import { de as leaderboardDe, en as leaderboardEn } from './translations/leaderboard';
import { de as tabsDe, en as tabsEn } from './translations/tabs';
import { de as essenDe, en as essenEn } from './translations/essen';
import { de as paywallDe, en as paywallEn } from './translations/paywall';
import { de as exerciseDe, en as exerciseEn } from './translations/exercise';
import { de as timerDe, en as timerEn } from './translations/timer';
import { de as errorRetryDe, en as errorRetryEn } from './translations/errorRetry';
import { de as offlineDe, en as offlineEn } from './translations/offline';
import { de as scannerDe, en as scannerEn } from './translations/scanner';
import { de as settingsDe, en as settingsEn } from './translations/settings';
import { de as stepsPromptDe, en as stepsPromptEn } from './translations/stepsPrompt';
import { de as lobbyDe, en as lobbyEn } from './translations/lobby';
import { de as friendsDe, en as friendsEn } from './translations/friends';
import { de as fastingDe, en as fastingEn } from './translations/fasting';

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
};

const en: Dict = {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.retry': 'Try again',
  'common.delete': 'Delete',
};

const DICTS: Record<Lang, Dict> = {
  de: {
    ...de, ...homeDe, ...trainingDe, ...planDe, ...foodDe, ...authDe, ...onboardingDe,
    ...profileDe, ...progressDe, ...waterDe, ...proteinDe, ...leaderboardDe, ...tabsDe,
    ...essenDe, ...paywallDe, ...exerciseDe, ...timerDe, ...errorRetryDe, ...offlineDe, ...scannerDe,
    ...settingsDe, ...stepsPromptDe, ...lobbyDe, ...friendsDe, ...fastingDe,
  },
  en: {
    ...en, ...homeEn, ...trainingEn, ...planEn, ...foodEn, ...authEn, ...onboardingEn,
    ...profileEn, ...progressEn, ...waterEn, ...proteinEn, ...leaderboardEn, ...tabsEn,
    ...essenEn, ...paywallEn, ...exerciseEn, ...timerEn, ...errorRetryEn, ...offlineEn, ...scannerEn,
    ...settingsEn, ...stepsPromptEn, ...lobbyEn, ...friendsEn, ...fastingEn,
  },
};

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = DICTS[lang]?.[key] ?? de[key] ?? key;
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}
