/**
 * Pure helpers for the screenshot feature. This module has no DOM or i18n
 * imports on purpose: the scaling and file-name rules are unit-tested in
 * Node (`test/screenshot-naming.test.js`).
 */

/** At least 2× for legible text, at most 3× to bound the canvas. */
export const SCALE_MIN = 2;
export const SCALE_MAX = 3;

/** Scale choices offered in settings (also i18n keys). */
export const SCALE_MODES = Object.freeze(['auto', '1', '2', '3']);

/** @param {number} [dpr] `window.devicePixelRatio` */
export function captureScale(dpr) {
  const ratio = Number(dpr);
  if (!Number.isFinite(ratio) || ratio <= 0) return SCALE_MIN;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, ratio));
}

/**
 * Capture scale from the `scale` setting (`auto` | `1` | `2` | `3`).
 * `auto` keeps the old device-pixel-ratio clamp.
 * @param {string} setting
 * @param {number} [dpr]
 */
export function resolveScale(setting, dpr) {
  if (setting === '1' || setting === '2' || setting === '3') return Number(setting);
  return captureScale(dpr);
}

/** Capture formats offered by the screenshot menu. */
export const FORMATS = Object.freeze(['png', 'jpeg']);

/** Post id from a `/…/status/<id>` link, or `''`. */
export function statusIdFromHref(href) {
  const match = String(href || '').match(/\/status\/(\d+)/);
  return match ? match[1] : '';
}

/** File extension for a format (`jpeg` → `jpg`, anything else → `png`). */
export function formatExtension(format) {
  return String(format || '').toLowerCase() === 'jpeg' ? 'jpg' : 'png';
}

/** `x-plus-post-<handle>-<id>.<ext>`, sanitized for every file system. */
export function postFileName(handle, id, ext = 'png') {
  const safeHandle = String(handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'post';
  const safeId = String(id || '').replace(/\D/g, '') || 'post';
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'png';
  return `x-plus-post-${safeHandle}-${safeId}.${safeExt}`;
}
