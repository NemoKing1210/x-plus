import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';

/** Current translation settings (always the live, normalized section). */
export const cfg = () => getFeatureSettings('translate');

/** Translation-scoped `t()`: `tr('btnHide')` → `t('translate.btnHide')`. */
export const tr = (key, vars) => t(`translate.${key}`, vars);

export const isAutoMode = () => cfg().translateMode === 'auto';
export const isReplaceMode = () => cfg().displayMode === 'replace';

/** @returns {'button'|'hover'|'split'} */
export function replaceRevealMode() {
  const mode = cfg().replaceReveal;
  return mode === 'hover' || mode === 'split' ? mode : 'button';
}

/** DOM markers (all prefixed `xp-` / `data-xp-`). */
export const ATTR = Object.freeze({
  post: 'data-xp-post',
  button: 'data-xp-btn',
  result: 'data-xp-result',
  toolbar: 'data-xp-toolbar',
  menu: 'data-xp-menu',
  observed: 'data-xp-observed',
  autoDone: 'data-xp-auto-done',
  autoQueued: 'data-xp-auto-queued',
  originalHtml: 'data-xp-original-html',
  translatedHtml: 'data-xp-translated-html',
  sourceLang: 'data-xp-source-lang',
  peekBound: 'data-xp-peek-bound',
});

/** Max parallel auto-translations while scrolling the feed. */
export const AUTO_TRANSLATE_MAX_INFLIGHT = 2;
