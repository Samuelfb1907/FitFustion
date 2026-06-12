// Sprach-Kontext: stellt die aktuelle Sprache (de/en), einen Umschalter und die
// Uebersetzungsfunktion t() bereit. Die Wahl wird auf dem Geraet gespeichert.
// Aufbau bewusst wie ThemeContext, damit es sich vertraut anfuehlt.
import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, translate } from '../lib/i18n';

const LANG_KEY = 'fitavo.lang';

type LanguageCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageCtx>({
  lang: 'de',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de'); // Standard: Deutsch

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then((v) => { if (v === 'de' || v === 'en') setLangState(v); })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(LanguageContext);
  return { lang, setLang };
}

export function useT() {
  return useContext(LanguageContext).t;
}
