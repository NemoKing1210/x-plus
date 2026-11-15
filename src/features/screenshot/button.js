import { SEL, UI_ATTR } from '../../core/constants.js';
import { isLoading, setButtonLabel } from '../../ui/action-button.js';
import { el, silencePointerEvents } from '../../utils/dom.js';
import { findHeaderActionsSlot, mountHeaderButton } from '../translate/placement.js';
import { ATTR, cfg, ss } from './config.js';
import { copyPost } from './copy.js';

/**
 * The screenshot control: one camera button in every post's header actions
 * row, placed after Translate when that feature is on. Mounting is idempotent
 * and runs from the shared debounced scan, so X re-renders repair themselves.
 */

function createButton() {
  const btn = el('button', 'xp-btn xp-btn--header xp-shot-btn');
  btn.type = 'button';
  btn.setAttribute(ATTR.button, '1');
  setButtonLabel(btn, ss('button'), { glyph: 'camera' });
  return btn;
}

function bindButton(btn, article) {
  if (btn.dataset.xpBound === '1') return;
  btn.dataset.xpBound = '1';
  silencePointerEvents(btn);
  btn.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (isLoading(btn)) return;
      copyPost(article, btn);
    },
    true,
  );
}

function placeButton(article, btn) {
  const slot = findHeaderActionsSlot(article);
  if (!slot) return false;

  mountHeaderButton(slot, btn, false);
  const wrap = btn.closest('.xp-header-action');
  if (!wrap) return false;
  wrap.setAttribute(ATTR.action, '1');

  // Keep the control next to Translate. Translate mounts into the same row;
  // putting ours after its wrapper matches "next to the Translate button"
  // whichever feature applied first.
  const translateWrap = [...slot.row.querySelectorAll('.xp-header-action')].find(
    (node) => node !== wrap && node.querySelector('[data-xp-btn]'),
  );
  if (translateWrap && translateWrap.nextElementSibling !== wrap) {
    translateWrap.insertAdjacentElement('afterend', wrap);
  }
  return true;
}

function ensureButton(article) {
  let btn = article.querySelector(`[${ATTR.button}]`);
  if (!btn) btn = createButton();
  if (!placeButton(article, btn)) return;
  bindButton(btn, article);
}

/** Skip our own UI and posts embedded inside another post (X Articles). */
function isOursOrNested(article) {
  if (article.closest(`[${UI_ATTR}]`)) return true;
  return Boolean(article.parentElement?.closest?.(SEL.article));
}

export function scanButtons() {
  if (!cfg().enabled) return;
  document.querySelectorAll(SEL.article).forEach((article) => {
    if (isOursOrNested(article)) return;
    ensureButton(article);
  });
}

export function removeAllButtons() {
  document.querySelectorAll(`[${ATTR.action}]`).forEach((wrap) => wrap.remove());
  document.querySelectorAll(`[${ATTR.button}]`).forEach((btn) => btn.remove());
}
