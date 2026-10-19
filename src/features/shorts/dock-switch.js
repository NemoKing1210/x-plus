import { getFeatureSettings, updateFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { getDock, syncDock } from '../../ui/dock.js';
import { el } from '../../utils/dom.js';
import { isFeedPage } from './engine.js';

/**
 * Quick switch next to the shortcut reminder (bottom left). Shown on feed
 * pages while the reminder is on, and whenever the mode is on, so there is
 * always a way to turn it off.
 */

let node = null;

function ensureSwitch() {
  if (node) return node;
  node = el('button', 'xp-dock-switch');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  node.append(el('span', 'xp-dock-switch__label'), el('span', 'xp-dock-switch__track'));
  node.lastChild.setAttribute('aria-hidden', 'true');
  node.addEventListener('click', () => {
    updateFeatureSettings('shorts', { enabled: !getFeatureSettings('shorts').enabled });
  });
  getDock().append(node);
  return node;
}

export function syncShortsSwitch() {
  const cfg = getFeatureSettings('shorts');
  const general = getFeatureSettings('general');
  const show = isFeedPage() && (cfg.enabled || (general.hotkey && general.hotkeyHint));
  if (!show && !node) return;

  const button = ensureSwitch();
  button.hidden = !show;
  button.setAttribute('aria-checked', String(cfg.enabled));
  button.classList.toggle('is-on', cfg.enabled);
  const label = t('shorts.dockLabel');
  button.firstChild.textContent = label;
  button.title = t('shorts.dockTitle');
  button.setAttribute('aria-label', label);
  syncDock();
}
