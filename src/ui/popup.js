import { UI_ATTR } from '../core/constants.js';
import { escapeAttr, escapeHtml } from '../utils/html.js';

/**
 * Small anchored popup menu (used by the media download picker).
 *
 * @typedef {object} PopupItem
 * @property {string} [id]
 * @property {string} label
 * @property {string} [hint]        - muted second line / right-aligned detail
 * @property {string} [iconHtml]    - leading icon markup
 * @property {boolean} [separator]  - render a divider instead of an item
 * @property {boolean} [disabled]
 * @property {() => void} [onSelect]
 */

let closeActive = null;

/**
 * Open a popup next to `anchor`. Only one popup exists at a time.
 * @param {{ anchor: Element, title?: string, items: PopupItem[], onClose?: () => void }} options
 * @returns {() => void} close function
 */
export function openPopup({ anchor, title = '', items, onClose }) {
  closeActive?.();

  const root = document.createElement('div');
  root.className = 'xp-popup';
  root.setAttribute(UI_ATTR, '');
  root.setAttribute('role', 'menu');

  const rows = items
    .map((item, index) => {
      if (item.separator) return '<div class="xp-popup__sep" role="separator"></div>';
      return (
        `<button type="button" class="xp-popup__item" role="menuitem" data-index="${index}"` +
        `${item.disabled ? ' disabled' : ''}>` +
        (item.iconHtml ? `<span class="xp-popup__icon">${item.iconHtml}</span>` : '') +
        `<span class="xp-popup__label">${escapeHtml(item.label)}</span>` +
        (item.hint ? `<span class="xp-popup__hint">${escapeHtml(item.hint)}</span>` : '') +
        `</button>`
      );
    })
    .join('');
  root.innerHTML =
    (title ? `<div class="xp-popup__title" title="${escapeAttr(title)}">${escapeHtml(title)}</div>` : '') +
    rows;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
    root.remove();
    if (closeActive === close) closeActive = null;
    onClose?.();
  };

  function onOutside(event) {
    if (root.contains(event.target) || anchor.contains(event.target)) return;
    close();
  }
  function onKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  root.addEventListener('click', (event) => {
    event.stopPropagation();
    const button = event.target.closest?.('.xp-popup__item');
    if (!button || button.disabled) return;
    const item = items[Number(button.dataset.index)];
    close();
    item?.onSelect?.();
  });
  // Keep X's tweet-open handlers out of the popup.
  for (const type of ['mousedown', 'pointerdown', 'mouseup', 'pointerup']) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }

  document.body.appendChild(root);
  place(root, anchor);

  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  root.querySelector('.xp-popup__item:not([disabled])')?.focus({ preventScroll: true });
  closeActive = close;
  return close;
}

function place(root, anchor) {
  const margin = 8;
  const rect = anchor.getBoundingClientRect();
  const { width, height } = root.getBoundingClientRect();
  let left = rect.right - width;
  let top = rect.bottom + 6;
  if (left < margin) left = Math.min(rect.left, window.innerWidth - width - margin);
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - height - 6);
  }
  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;
}
