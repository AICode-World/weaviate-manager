import React, { createContext, useContext, useState, useMemo } from 'react';
import type { Lang } from './locales';
import { t as translate } from './locales';

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export const useI18n = () => useContext(I18nContext);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('en');
  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
  }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
