import { SEL, UI_ATTR } from '../../core/constants.js';
import { onMutation } from '../../core/scan.js';
import { showToast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';
import { escapeHtml } from '../../utils/html.js';
import { fmt } from '../../utils/format.js';
import { isInAutoAllowlist, toggleAutoAllowlistHandle } from './allowlist.js';
import { formatHandleDisplay, resolveHandleFromDropdownTrigger } from './author.js';
import { ATTR, cfg, tr } from './config.js';
import { scanPosts } from './controller.js';
import { isAccountBlocked, toggleAccountBlocklistHandle } from './filters.js';

/**
 * Adds "Auto-translate this account" / "Never translate this account" to the
 * ⋮ menu of a post. X portals that menu to the document root, so we watch
 * for it with a low-latency mutation subscriber.
 */

const CARET_OPEN = `${SEL.article} ${SEL.caret}[aria-expanded="true"]`;

/** Words that identify a tweet action menu (any UI language we know of). */
const MENU_SIGNALS = [
  'delete',
  'embed',
  'mute',
  'block',
  'report',
  'not interested',
  'follow',
  'unfollow',
  'bookmark',
  'add/remove',
  'view post',
  'copy link',
  'удалить',
  'встроить',
  'игнорировать',
  'пожаловаться',
  'читать',
];

function isTweetActionMenu(menu) {
  if (!(menu instanceof Element)) return false;
  if (menu.querySelector(`[${ATTR.menu}]`)) return true;

  const items = menu.querySelectorAll('[role="menuitem"], [data-testid]');
  if (!items.length) return false;

  const text = (menu.textContent || '').toLowerCase();
  if (MENU_SIGNALS.some((signal) => text.includes(signal))) return true;

  // Fallback: a caret was expanded nearby.
  return Boolean(document.querySelector(CARET_OPEN));
}

function buildMenuShell(kind, label, iconName, onClick) {
  const item = document.createElement('div');
  item.setAttribute(ATTR.menu, kind);
  item.setAttribute(UI_ATTR, '');
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', label);
  item.className = 'xp-menu-item';
  item.style.cssText =
    'display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 12px 16px; outline: 0; cursor: pointer; color: inherit;';
  item.innerHTML =
    `<div class="xp-menu-item__icon" style="display:flex;width:18.75px;height:18.75px;align-items:center;justify-content:center;">${icon(iconName)}</div>` +
    `<div dir="auto" class="xp-menu-item__label" style="font-size: 15px; line-height: 20px; font-weight: 700; flex: 1 1 0%;">${escapeHtml(label)}</div>`;

  item.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    },
    true,
  );
  return item;
}

function closeOpenMenus() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

/** Shared toggle flow: invalid handle warning, success/info toast, rescan, close menu. */
function runToggle(handle, toggle, addedKey, removedKey) {
  const result = toggle(handle);
  if (!result.ok && result.reason === 'invalid') {
    showToast(tr('allowlistInvalid'), { type: 'warning' });
    return;
  }
  const display = formatHandleDisplay(result.handle || handle);
  if (result.added) showToast(fmt(tr(addedKey), { handle: display }), { type: 'success' });
  else showToast(fmt(tr(removedKey), { handle: display }), { type: 'info' });
  scanPosts();
  closeOpenMenus();
}

function buildAutoMenuItem(handle) {
  const label = isInAutoAllowlist(handle) ? tr('menuRemoveAutoAccount') : tr('menuAddAutoAccount');
  return buildMenuShell('auto', label, 'translate', () =>
    runToggle(handle, toggleAutoAllowlistHandle, 'allowlistAdded', 'allowlistRemoved'),
  );
}

function buildBlockMenuItem(handle) {
  const label = isAccountBlocked(handle) ? tr('menuUnblockAccount') : tr('menuBlockAccount');
  return buildMenuShell('block', label, 'block', () =>
    runToggle(handle, toggleAccountBlocklistHandle, 'blocklistAdded', 'blocklistRemoved'),
  );
}

function findOpenDropdownTrigger() {
  return (
    document.querySelector(CARET_OPEN) ||
    document.querySelector(`${SEL.article} ${SEL.caret}[aria-pressed="true"]`) ||
    document.querySelector(`${SEL.article} ${SEL.caret}`)
  );
}

function menuItemHost(menu) {
  const first = menu.querySelector('[role="menuitem"]') || menu.querySelector('[data-testid]');
  return first?.parentElement || menu;
}

function injectIntoMenu(menu, handle) {
  const existingAuto = menu.querySelector(`[${ATTR.menu}="auto"]`);
  const existingBlock = menu.querySelector(`[${ATTR.menu}="block"]`);
  const host = menuItemHost(menu);

  if (cfg().translateMode === 'auto') {
    if (!existingAuto) {
      const first = menu.querySelector('[role="menuitem"]') || menu.querySelector('[data-testid]');
      const item = buildAutoMenuItem(handle);
      if (first?.parentElement) first.parentElement.insertBefore(item, first);
      else host.appendChild(item);
    }
  } else {
    existingAuto?.remove();
  }

  if (!existingBlock) {
    const after = menu.querySelector(`[${ATTR.menu}="auto"]`);
    const item = buildBlockMenuItem(handle);
    if (after?.parentElement) after.insertAdjacentElement('afterend', item);
    else host.appendChild(item);
  }
}

function removeMenuItems() {
  document.querySelectorAll(`[${ATTR.menu}]`).forEach((node) => node.remove());
}

export function scanPostMenus() {
  if (!cfg().enabled) {
    removeMenuItems();
    return;
  }
  const trigger = findOpenDropdownTrigger();
  const handle = resolveHandleFromDropdownTrigger(trigger);
  if (!handle) return;

  document.querySelectorAll('[role="menu"]').forEach((menu) => {
    if (isTweetActionMenu(menu)) injectIntoMenu(menu, handle);
  });
}

/** Watch portaled tweet menus; low latency so the item appears with the menu. */
export function observePostMenus() {
  onMutation(scanPostMenus, 40);
  scanPostMenus();
}
