/**
 * Helpers shared by both DOM profiles.
 */

export const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[aria-modal="true"]',
  '.xp-gallery',
  '.xp-popup',
  '.xp-settings-backdrop',
  '.xp-confirm-overlay',
].join(', ');

export function normalizeHandleText(text = '') {
  return text.trim().replace(/^@/, '').toLowerCase();
}

export function overlayRoots(root) {
  return [...root.querySelectorAll(OVERLAY_SELECTOR)];
}
