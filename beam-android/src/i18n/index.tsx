import React, { createContext, useContext, useMemo, useState } from 'react';

import { fr, type Dict } from './fr';
import { en } from './en';

type Locale = 'fr' | 'en';
const DICTS: Record<Locale, Dict> = { fr, en };

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Two-arg, fully type-safe lookup: t('connect', 'start'). */
  t: <S extends keyof Dict>(section: S, key: keyof Dict[S]) => string;
}

const Ctx = createContext<I18nValue | null>(null);

function detectLocale(): Locale {
  // expo-localization isn't a dependency; default to English.
  return 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectLocale());

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (section, key) => {
        const dict = DICTS[locale] ?? fr;
        return String((dict[section] as Record<string, string>)[key as string]);
      },
    }),
    [locale]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18nValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
