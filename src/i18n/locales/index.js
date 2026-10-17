import de from './de.js';
import en from './en.js';
import es from './es.js';
import fr from './fr.js';
import ja from './ja.js';
import pt from './pt.js';
import ru from './ru.js';
import zh from './zh.js';

/**
 * Locale registry. English is the source of truth and the fallback for any
 * key a locale does not define yet (see scripts/check-i18n.mjs).
 */
export const TRANSLATIONS = { en, ru, zh, es, pt, de, fr, ja };
