import { LOCALE_ALIASES, SUPPORTED_LOCALES } from './meta.js';
import { TRANSLATIONS } from './locales/index.js';
import { fmt } from '../utils/format.js';

export {
  LOCALE_FLAG_AUTO,
  LOCALE_FLAGS,
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
} from './meta.js';

let activeLocale = 'en';

function matchLocale(language) {
  const normalized = String(language || '').trim().toLowerCase();
  return (
    LOCALE_ALIASES[normalized] ||
    LOCALE_ALIASES[normalized.split('-')[0]] ||
    null
  );
}

function detectBrowserLocale() {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of languages) {
    const locale = matchLocale(language);
    if (locale) return locale;
  }
  return 'en';
}

/** Resolve the UI language preference (`auto` or a supported code) to a locale. */
export function resolveLocale(preference = 'auto') {
  if (preference !== 'auto' && SUPPORTED_LOCALES.includes(preference)) return preference;
  return detectBrowserLocale();
}

export function configureLocale(preference = 'auto') {
  activeLocale = resolveLocale(preference);
  return activeLocale;
}

export function getLocale() {
  return activeLocale;
}

/** Translate a key; falls back to English, then to the key itself. */
export function t(key, vars) {
  const template = TRANSLATIONS[activeLocale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return vars ? fmt(template, vars) : template;
}

/**
 * Translation target for post translation: explicit setting, or the UI /
 * browser locale (`zh` maps to Simplified Chinese).
 */
export function resolveTargetLang(preference, uiPreference = 'auto') {
  if (preference && preference !== 'auto') return preference === 'zh' ? 'zh-CN' : preference;
  const ui = resolveLocale(uiPreference);
  return ui === 'zh' ? 'zh-CN' : ui || 'en';
}
