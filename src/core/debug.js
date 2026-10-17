/**
 * Structured console diagnostics for X Plus.
 *
 * Every failure carries a stable `XP-####` code: grep the codebase for the
 * code to jump straight to the throw site. Errors and warnings always print;
 * `logInfo` traces print only in verbose mode, enabled via
 * `localStorage.setItem('xp_debug', '1')` or `window.__XP_DEBUG__ = true`.
 */

export const Codes = {
  /** A bus listener threw while handling an event. */
  BUS_LISTENER: 'XP-1001',
  /** Persisting settings to GM storage failed. */
  SETTINGS_PERSIST: 'XP-1002',
  /** Importing a settings backup failed. */
  SETTINGS_IMPORT: 'XP-1003',
  /** A feature hook (init/apply/scan/navigate) threw. */
  FEATURE_HOOK: 'XP-1010',
  /** A translation provider request failed. */
  TRANSLATE_REQUEST: 'XP-1110',
  /** Translating one post failed. */
  TRANSLATE_FAILED: 'XP-1201',
  /** Reading or writing the translation cache failed. */
  TRANSLATE_CACHE: 'XP-1210',
  /** Resolving media of a post failed (syndication + GraphQL). */
  MEDIA_RESOLVE: 'XP-1301',
  /** Downloading a media file failed. */
  MEDIA_DOWNLOAD: 'XP-1302',
  /** A declutter rule threw while searching the DOM. */
  DECLUTTER_RULE: 'XP-1401',
};

const BADGE_STYLE =
  'background:#1d9bf0;color:#fff;border-radius:3px;padding:1px 6px;font-weight:bold';
const WARN_BADGE_STYLE =
  'background:#b58900;color:#fff;border-radius:3px;padding:1px 6px;font-weight:bold';
const CODE_STYLE = 'font-weight:bold';
const INFO_STYLE = 'color:#71767b';

export function isVerbose() {
  try {
    if (typeof window !== 'undefined' && window.__XP_DEBUG__ === true) return true;
  } catch {
    /* sandbox without window access */
  }
  try {
    return localStorage.getItem('xp_debug') === '1';
  } catch {
    return false;
  }
}

/** Build an Error carrying a stable code plus structured details. */
export function fail(code, message, details, cause) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  if (details !== undefined) error.details = details;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function print(printer, badge, code, message, details) {
  if (details === undefined) {
    printer(`%cX Plus%c ${code} ${message}`, badge, CODE_STYLE);
  } else {
    printer(`%cX Plus%c ${code} ${message}`, badge, CODE_STYLE, details);
  }
}

/** Always printed: a failure the user or developer must see. */
export function logError(code, message, details) {
  print(console.error, BADGE_STYLE, code, message, details);
}

/** Always printed: degraded behavior that recovered on its own. */
export function logWarn(code, message, details) {
  print(console.warn, WARN_BADGE_STYLE, code, message, details);
}

/** Printed only in verbose mode: traces for development. */
export function logInfo(area, message, details) {
  if (!isVerbose()) return;
  if (details === undefined) {
    console.info(`%cX Plus · ${area}%c ${message}`, INFO_STYLE, '');
  } else {
    console.info(`%cX Plus · ${area}%c ${message}`, INFO_STYLE, '', details);
  }
}
