import { registerFeature } from '../../core/features.js';
import { t } from '../../i18n/index.js';
import { filterFields } from './config.js';
import { sweep, sync } from './engine.js';
import { renderFilterTab } from './settings.js';

/**
 * Post filter: user-built rules hide matching posts in the timeline. The
 * engine watches the page itself, so there is no debounced `scan` hook.
 */
registerFeature({
  id: 'filter',
  order: 35,
  fields: filterFields,
  tabs: [
    {
      id: 'filter',
      titleKey: 'filter.title',
      badge(root) {
        const cfg = root.filter;
        if (!cfg?.enabled) return t('common.off');
        return String(cfg.rules.filter((rule) => rule.enabled).length);
      },
      render: renderFilterTab,
    },
  ],

  apply(cfg) {
    sync(cfg);
  },

  navigate() {
    sweep();
  },
});
