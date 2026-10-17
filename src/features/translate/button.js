import { escapeHtml } from '../../utils/html.js';
import { icon } from '../../ui/icons.js';
import { isReplaceMode, replaceRevealMode, tr } from './config.js';
import { setTranslatingBlur, syncToolbarVisibility } from './display.js';

/**
 * Visual states of the Translate button. All state lives in the DOM
 * (`data-xp-state`, `.is-loading`) so the button survives X re-rendering.
 */

/** Replace + hover: peek replaces Show original — hide the button while shown. */
function shouldHideShownReplaceButton() {
  return isReplaceMode() && replaceRevealMode() === 'hover';
}

export function isShown(btn) {
  return btn.dataset.xpState === 'shown';
}

export function isLoading(btn) {
  return btn.classList.contains('is-loading');
}

export function clearButtonLoading(btn) {
  btn.classList.remove('is-loading');
  btn.disabled = false;
  btn.removeAttribute('aria-busy');
}

/** @param {'translate'|'hide'|'original'|'retry'} glyph */
export function setButtonLabel(btn, label, { loading = false, glyph = 'translate' } = {}) {
  const header = btn.classList.contains('xp-btn--header');
  btn.classList.toggle('is-loading', loading);
  btn.disabled = loading;
  btn.setAttribute('aria-label', label);
  if (loading) {
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML =
      `<span class="xp-btn__spinner" aria-hidden="true"></span>` +
      `<span class="xp-btn__label">${escapeHtml(label)}</span>`;
    return;
  }
  btn.removeAttribute('aria-busy');
  btn.innerHTML =
    `${icon(glyph, 'xp-btn__icon')}` + `<span class="xp-btn__label">${escapeHtml(label)}</span>`;
  if (header) btn.title = label;
  else btn.removeAttribute('title');
}

export function applyShownButton(btn, postEl) {
  btn.dataset.xpState = 'shown';
  if (shouldHideShownReplaceButton()) {
    clearButtonLoading(btn);
    btn.hidden = true;
    syncToolbarVisibility(postEl);
    return;
  }
  btn.hidden = false;
  const replace = isReplaceMode();
  setButtonLabel(btn, replace ? tr('btnShowOriginal') : tr('btnHide'), {
    glyph: replace ? 'original' : 'hide',
  });
  syncToolbarVisibility(postEl);
}

export function applyIdleButton(btn, postEl) {
  btn.dataset.xpState = '';
  btn.hidden = false;
  setButtonLabel(btn, tr('btnTranslate'));
  syncToolbarVisibility(postEl);
}

/** Switch the button + text into the "translating…" look. */
export function beginTranslateUi(postEl, btn) {
  if (shouldHideShownReplaceButton()) {
    setTranslatingBlur(postEl, true);
    btn.hidden = true;
    btn.classList.add('is-loading');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    syncToolbarVisibility(postEl);
    return;
  }
  btn.hidden = false;
  syncToolbarVisibility(postEl);
  setButtonLabel(btn, tr('translating'), { loading: true });
}

/** Shown state for notices (language skipped): label is always "Hide translation". */
export function applyNoticeShownButton(btn, postEl) {
  btn.hidden = false;
  setButtonLabel(btn, tr('btnHide'), { glyph: 'hide' });
  btn.dataset.xpState = 'shown';
  syncToolbarVisibility(postEl);
}
