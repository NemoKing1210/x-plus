import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';

/** Current screenshot settings (always the live, normalized section). */
export const cfg = () => getFeatureSettings('screenshot');

/** Screenshot-scoped `t()`: `ss('button')` → `t('screenshot.button')`. */
export const ss = (key, vars) => t(`screenshot.${key}`, vars);

/** DOM markers (all prefixed `xp-` / `data-xp-`). */
export const ATTR = Object.freeze({
  button: 'data-xp-shot-btn',
  action: 'data-xp-shot-action',
});

/** Capture scale bounds (the pure rules live in `naming.js`). */
export { SCALE_MAX, SCALE_MIN } from './naming.js';
export const CAPTURE_TIMEOUT_MS = 15_000;
export const MAX_CANVAS_SIZE = 16_384;
