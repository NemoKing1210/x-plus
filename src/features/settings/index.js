import { GM_registerMenuCommand } from '$';
import { on } from '../../core/bus.js';
import { registerFeature } from '../../core/features.js';
import { cacheTab } from '../translate/settings.js';
import { t } from '../../i18n/index.js';
import { ensureNavButton, setNavButtonHandler } from './nav-button.js';
import { syncHotkey } from './hotkey.js';
import { openSettings } from './panel.js';
import { aboutTab } from './tabs/about.js';
import { backupTab } from './tabs/backup.js';

export { openSettings } from './panel.js';

/**
 * The settings UI itself is a feature: it owns no settings, but contributes
 * the Cache / Backup / About tabs, the userscript-manager menu command and the
 * sidebar entry point.
 */
registerFeature({
  id: 'settings',
  order: 900,
  fields: {},
  tabs: [cacheTab, backupTab, aboutTab],

  init() {
    setNavButtonHandler(() => openSettings());
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand(t('menu.settings'), () => openSettings());
    }
    // The sidebar entry and the UI language live in the "general" section.
    on('settings:general', ensureNavButton);
    on('settings:general', syncHotkey);
    ensureNavButton();
    syncHotkey();
  },

  scan() {
    ensureNavButton();
  },
});
