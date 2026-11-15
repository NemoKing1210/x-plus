import {
  clearButtonLoading,
  isLoading,
  setButtonLabel,
} from '../../ui/action-button.js';
import { isReplaceMode, replaceRevealMode, tr } from './config.js';
import { setTranslatingBlur, syncToolbarVisibility } from './display.js';

export { clearButtonLoading, isLoading, setButtonLabel };

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

export function applyShownButton(btn, postEl) {
  if (btn.dataset.xpState !== 'shown') btn.dataset.xpState = 'shown';
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
  if (btn.dataset.xpState !== '') btn.dataset.xpState = '';
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
  if (btn.dataset.xpState !== 'shown') btn.dataset.xpState = 'shown';
  syncToolbarVisibility(postEl);
}
