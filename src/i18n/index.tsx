import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';
import { en } from './en';
import { fr, type Messages } from './fr';

export type UiLanguage = 'fr' | 'en';

export const MESSAGES: Record<UiLanguage, Messages> = { fr, en };

/** Langue du navigateur : français par défaut, anglais si le navigateur est en anglais. */
export function detectUiLanguage(languages: readonly string[] = globalThis.navigator?.languages ?? []): UiLanguage {
  for (const language of languages) {
    const code = language.toLowerCase();
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('en')) return 'en';
  }
  return 'fr';
}

interface I18nValue {
  t: Messages;
  language: UiLanguage;
  setLanguage(language: UiLanguage): void;
}

// Valeur par défaut (français) : les composants restent utilisables sans fournisseur (tests, outils).
const I18nContext = createContext<I18nValue>({ t: fr, language: 'fr', setLanguage: () => {} });

/**
 * Fournit la langue de l'interface à toute l'application : une seule lecture
 * des réglages, au lieu d'une par composant.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [settings, updateSettings] = useSettings();
  const language = settings.uiLanguage ?? detectUiLanguage();

  // Lecteurs d'écran et correcteurs : la langue déclarée de la page suit l'interface.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(
    () => ({ t: MESSAGES[language], language, setLanguage: (uiLanguage) => updateSettings({ uiLanguage }) }),
    [language, updateSettings],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export { I18nContext };
export type { Messages };
