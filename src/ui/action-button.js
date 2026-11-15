import { escapeHtml } from '../utils/html.js';
import { icon } from './icons.js';

/**
 * State helpers shared by our action buttons (Translate, Screenshot). All
 * state lives in the DOM (`data-xp-state`, `.is-loading`) so the button
 * survives X re-rendering.
 */

export function isLoading(btn) {
  return btn.classList.contains('is-loading');
}

export function clearButtonLoading(btn) {
  btn.classList.remove('is-loading');
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
}

/** @param {'translate'|'hide'|'original'|'retry'|'camera'} glyph */
export function setButtonLabel(btn, label, { loading = false, glyph = 'translate' } = {}) {
  const header = btn.classList.contains('xp-btn--header');
  const wasLoading = btn.classList.contains('is-loading');
  if (wasLoading !== loading) {
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
    if (loading) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  }
  if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  if (header) {
    if (btn.title !== label) btn.title = label;
  } else if (btn.hasAttribute('title')) {
    btn.removeAttribute('title');
  }

  // Rescans re-apply the same state constantly: rewriting innerHTML every time
  // would recreate the icon and force a layout pass for nothing.
  const signature = `${loading ? '1' : '0'}|${glyph}|${label}`;
  if (btn.dataset.xpLabelSig === signature) return;
  btn.dataset.xpLabelSig = signature;

  if (loading) {
    btn.innerHTML =
      `<span class="xp-btn__spinner" aria-hidden="true"></span>` +
      `<span class="xp-btn__label">${escapeHtml(label)}</span>`;
    return;
  }
  btn.innerHTML =
    `${icon(glyph, 'xp-btn__icon')}` + `<span class="xp-btn__label">${escapeHtml(label)}</span>`;
}
