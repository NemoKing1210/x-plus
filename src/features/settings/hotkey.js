import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { el } from '../../utils/dom.js';
import { closeSettings, isSettingsOpen, openSettings } from './panel.js';

/**
 * Ctrl+M opens and closes the settings, with a faint reminder in the bottom left corner
 * of the screen. Both parts are switchable in General → Interface.
 */

let installed = false;
let hint = null;

const isHotkey = (event) =>
  event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey &&
  !event.metaKey &&
  // `code` keeps the shortcut working on non-Latin keyboard layouts.
  (event.code === 'KeyM' || event.key.toLowerCase() === 'm');

function onKeyDown(event) {
  if (!getFeatureSettings('general').hotkey || !isHotkey(event) || event.repeat) return;
  event.preventDefault();
  event.stopPropagation();
  if (!isSettingsOpen()) {
    openSettings();
    return;
  }
  // Like Escape: a confirm dialog or popup on top gets the shortcut first.
  if (!document.querySelector('.xp-confirm-overlay, .xp-popup')) closeSettings();
}

function ensureHint() {
  if (hint) return hint;
  hint = el('button', 'xp-hotkey-hint');
  hint.type = 'button';
  hint.append(el('kbd', 'xp-hotkey-hint__keys', 'Ctrl + M'), el('span', 'xp-hotkey-hint__text'));
  hint.addEventListener('click', () => openSettings());
  (document.body || document.documentElement).appendChild(hint);
  return hint;
}

/** Wire the shortcut once and sync the hint with the current settings. */
export function syncHotkey() {
  if (!installed) {
    installed = true;
    document.addEventListener('keydown', onKeyDown, true);
  }
  const cfg = getFeatureSettings('general');
  const show = cfg.hotkey && cfg.hotkeyHint;
  if (!show && !hint) return;
  const node = ensureHint();
  node.hidden = !show;
  const text = t('hotkey.hint');
  node.lastChild.textContent = text;
  node.title = text;
  node.setAttribute('aria-label', `Ctrl + M — ${text}`);
}
