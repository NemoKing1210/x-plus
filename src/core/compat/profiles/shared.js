/**
 * Helpers shared by both DOM profiles.
 */

/** Marks the root of every element we inject; profiles never scan inside it. */
export const UI_ATTR = 'data-xp-ui';

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

/** Font weight of a navigation row's label: 700 means the row is the active route. */
export function navLabelWeight(node) {
  const label = node?.querySelector?.('div[dir]');
  if (!label) return null;
  const raw = getComputedStyle(label).fontWeight;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  if (raw === 'bold') return 700;
  if (raw === 'normal') return 400;
  return null;
}
