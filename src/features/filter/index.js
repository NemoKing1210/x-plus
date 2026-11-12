import { registerFeature } from '../../core/features.js';
import { filterFields } from './config.js';
import { sweep, sync } from './engine.js';

/**
 * Post filter: user-built rules hide matching posts in the timeline. The tab
 * is added in settings.js; the engine watches the page itself, so there is no
 * debounced `scan` hook.
 */
registerFeature({
  id: 'filter',
  order: 35,
  fields: filterFields,

  apply(cfg) {
    sync(cfg);
  },

  navigate() {
    sweep();
  },
});
