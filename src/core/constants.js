import pkg from '../../package.json' with { type: 'json' };
import { UI_ATTR } from './compat/profiles/shared.js';

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const SCRIPT_NAME = 'X Plus';
export const SCRIPT_VERSION = pkg.version;
export const REPO_URL = 'https://github.com/NemoKing1210/x-plus';
export const AUTHOR_NAME = 'NemoKing';
export const AUTHOR_HANDLE = 'NemoKing1210';
export const AUTHOR_EMAIL = 'nemoking1210@gmail.com';
export const AUTHOR_URL = 'https://github.com/NemoKing1210';
export const AUTHOR_AVATAR_URL =
  'https://avatars.githubusercontent.com/u/58397369?v=4';

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export const SETTINGS_KEY = 'xp_settings_v1';
export const TRANSLATION_CACHE_KEY = 'xp_translation_cache_v1';
/** Whether auto-scroll was paused by the user (runtime state, not a setting). */
export const SHORTS_PAUSED_KEY = 'xp_shorts_paused_v1';

/* ------------------------------------------------------------------ */
/* DOM conventions                                                     */
/* ------------------------------------------------------------------ */

/** Marks the root of every element we inject (excluded from DOM scans). */
export { UI_ATTR };
/** Elements that are ours, or live inside a post we already enhanced (never rescanned). */
export const OWN_SELECTOR = `[${UI_ATTR}], [data-xp-post]`;
/** Set on <html> once the script booted (guards double injection). */
export const ROOT_ATTR = 'data-xp-root';
/**
 * Shorts mode contract with the other features: the timeline cell of the current
 * post carries `data-xp-shorts="active"`, plus `data-xp-shorts-settled` once it has
 * stayed current for a moment; `<html data-xp-shorts-focus>` says that only that post
 * may do automatic work (e.g. translate).
 */
export const SHORTS_CELL_ATTR = 'data-xp-shorts';
export const SHORTS_SETTLED_ATTR = 'data-xp-shorts-settled';
export const SHORTS_FOCUS_ATTR = 'data-xp-shorts-focus';
/** Set on <html> with the detected X theme (light | dim | dark). */
export const THEME_ATTR = 'data-xp-theme';

/* ------------------------------------------------------------------ */
/* Timing / limits                                                     */
/* ------------------------------------------------------------------ */

/** Debounce for DOM mutation rescans. */
export const SCAN_DEBOUNCE_MS = 350;
/** Poll interval for SPA URL changes that bypass the History API hooks. */
export const NAVIGATION_POLL_MS = 500;
/** Soft advisory budget for the settings cache meter. */
export const CACHE_SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
