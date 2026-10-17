import { t } from '../../i18n/index.js';
import { el } from '../../utils/dom.js';

/**
 * Minimal modal confirmation shown above the settings panel.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const overlay = el('div', 'xp-confirm-overlay');
    const box = el('div', 'xp-confirm');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.append(el('h3', 'xp-confirm__title', title));
    if (message) box.appendChild(el('p', 'xp-confirm__text', message));

    const actions = el('div', 'xp-confirm__actions');
    const cancel = el('button', 'xp-btn-ui xp-btn-ui--ghost', t('panel.cancel'));
    const ok = el(
      'button',
      `xp-btn-ui ${danger ? 'xp-btn-ui--danger-solid' : 'xp-btn-ui--primary'}`,
      confirmLabel || t('panel.confirm'),
    );
    cancel.type = 'button';
    ok.type = 'button';
    actions.append(cancel, ok);
    box.appendChild(actions);
    overlay.appendChild(box);

    const finish = (value) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };
    function onKey(event) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      finish(false);
    }

    cancel.addEventListener('click', () => finish(false));
    ok.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(overlay);
    cancel.focus();
  });
}
