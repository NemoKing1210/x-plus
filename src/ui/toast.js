import { UI_ATTR } from '../core/constants.js';
import { getFeatureSettings } from '../core/settings.js';
import { t } from '../i18n/index.js';
import { icon } from './icons.js';
import { escapeAttr } from '../utils/html.js';

const HOST_ID = 'xp-toast-host';
const MAX_VISIBLE = 4;
const TYPES = ['info', 'success', 'warning', 'error'];
/** Icon per toast type (success reuses the check glyph). */
const TYPE_ICONS = { info: 'info', success: 'check', warning: 'warning', error: 'error' };

function ensureHost(position) {
  let host = document.getElementById(HOST_ID);
  if (!host?.isConnected) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute(UI_ATTR, '');
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-relevant', 'additions');
    (document.body || document.documentElement).appendChild(host);
  }
  host.className = `xp-toast-host xp-toast-host--${position}`;
  return host;
}

function dismissElement(node) {
  if (!node || node.dataset.xpLeaving === '1') return;
  node.dataset.xpLeaving = '1';
  node.classList.add('is-leaving');
  const done = () => node.remove();
  node.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 280);
}

function defaultTitle(type) {
  return t(`toast.title.${type}`);
}

/**
 * @typedef {object} ToastOptions
 * @property {'info'|'success'|'warning'|'error'} [type]
 * @property {string} [title]
 * @property {number} [duration] - ms; `0` keeps the toast until dismissed
 * @property {boolean} [force]    - show even when toasts are disabled in settings
 *
 * @typedef {object} ToastHandle
 * @property {(patch: {message?: string, title?: string, type?: string, progress?: number, duration?: number}) => void} update
 * @property {() => void} dismiss
 */

const NOOP_HANDLE = { update() {}, dismiss() {} };

/**
 * Show a toast. Returns a handle so long-running work (downloads) can update
 * the message / progress in place and dismiss it when finished.
 * @param {string} message
 * @param {ToastOptions} [options]
 * @returns {ToastHandle}
 */
export function showToast(message, options = {}) {
  const cfg = getFeatureSettings('general');
  if (cfg.toastsEnabled === false && !options.force) return NOOP_HANDLE;

  let type = TYPES.includes(options.type) ? options.type : 'info';
  const host = ensureHost(cfg.toastPosition);
  while (host.children.length >= MAX_VISIBLE) dismissElement(host.firstElementChild);

  const node = document.createElement('div');
  node.setAttribute(UI_ATTR, '');
  node.setAttribute('role', 'status');
  node.innerHTML =
    `<span class="xp-toast__icon" aria-hidden="true"></span>` +
    `<span class="xp-toast__body">` +
    `<span class="xp-toast__title"></span>` +
    `<span class="xp-toast__text"></span>` +
    `</span>` +
    `<button type="button" class="xp-toast__close" aria-label="${escapeAttr(t('toast.dismiss'))}">${icon('close')}</button>` +
    `<span class="xp-toast__bar"></span>`;

  const iconEl = node.querySelector('.xp-toast__icon');
  const titleEl = node.querySelector('.xp-toast__title');
  const textEl = node.querySelector('.xp-toast__text');
  const barEl = node.querySelector('.xp-toast__bar');
  let timer = 0;
  let customTitle = options.title || '';

  const paintType = () => {
    node.className = `xp-toast xp-toast--${type}${node.classList.contains('is-visible') ? ' is-visible' : ''}`;
    iconEl.innerHTML = icon(TYPE_ICONS[type]);
    const title = customTitle || defaultTitle(type);
    titleEl.textContent = title;
    titleEl.hidden = !title;
  };

  const arm = (ms) => {
    clearTimeout(timer);
    barEl.style.animation = 'none';
    barEl.style.width = '';
    if (!(ms > 0)) {
      barEl.hidden = true;
      return;
    }
    barEl.hidden = false;
    void barEl.offsetWidth;
    barEl.style.animation = '';
    barEl.style.animationDuration = `${ms}ms`;
    timer = setTimeout(() => dismissElement(node), ms);
  };

  const setProgress = (ratio) => {
    clearTimeout(timer);
    barEl.hidden = false;
    barEl.style.animation = 'none';
    barEl.style.transform = 'none';
    barEl.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
  };

  textEl.textContent = String(message || '');
  textEl.hidden = !textEl.textContent;
  paintType();

  node
    .querySelector('.xp-toast__close')
    .addEventListener('click', () => dismissElement(node));
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));

  const duration = Number.isFinite(options.duration) ? options.duration : cfg.toastDuration * 1000;
  arm(duration);

  return {
    update(patch = {}) {
      if (!node.isConnected || node.dataset.xpLeaving === '1') return;
      if (patch.type && TYPES.includes(patch.type)) type = patch.type;
      if (patch.title != null) customTitle = patch.title;
      if (patch.message != null) {
        textEl.textContent = String(patch.message);
        textEl.hidden = !textEl.textContent;
      }
      paintType();
      if (typeof patch.progress === 'number') setProgress(patch.progress);
      if (Number.isFinite(patch.duration)) {
        barEl.style.transform = '';
        arm(patch.duration);
      }
    },
    dismiss: () => dismissElement(node),
  };
}

/** Shorthand used by tabs / menus for plain notices. */
export function notify(message, type = 'info', options = {}) {
  return showToast(message, { ...options, type });
}
