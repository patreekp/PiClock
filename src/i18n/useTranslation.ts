import translations, { type Language, type TranslationKey } from './translations';
import { useAppStore } from '../store/useAppStore';

export function useTranslation() {
  const language = useAppStore((s) => s.language);
  const dict = translations[language] ?? translations.en;

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let str: string = (dict as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }

  return { t, language };
}

export type { Language, TranslationKey };