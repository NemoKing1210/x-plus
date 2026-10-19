import { on } from '../../core/bus.js';
import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { syncShortsSwitch } from './dock-switch.js';
import { syncShorts } from './engine.js';

/**
 * Shorts mode: browse the feed one post at a time, like YouTube Shorts. The
 * wheel and ↑ / ↓ (or J / K) jump to the neighbouring post and centre it; the
 * current post grows a little, the ones around it are blurred.
 */

function sync() {
  syncShorts();
  syncShortsSwitch();
}

registerFeature({
  id: 'shorts',
  order: 25,

  fields: {
    enabled: field.bool(false),
    /** ↑ / ↓ and J / K step through posts. */
    keys: field.bool(true),
    /** Previous / next buttons beside the current post. */
    buttons: field.bool(true),
    /** Length of the transitions between posts. */
    speed: field.enum(['slow', 'normal', 'fast'], 'normal'),
    /** Size of the current post, in percent. */
    scale: field.int(105, { min: 100, max: 120 }),
    /** Blur of the other posts, in px. */
    blur: field.int(3, { min: 0, max: 12 }),
  },

  tabs: [
    {
      id: 'shorts',
      titleKey: 'shorts.title',
      badge: (draft) => (draft.shorts.enabled ? '' : t('common.off')),
      sections: [
        {
          titleKey: 'shorts.sectionMain',
          descKey: 'shorts.sectionMainDesc',
          controls: [
            { type: 'switch', path: 'enabled', labelKey: 'shorts.enabled', hintKey: 'shorts.enabledHint' },
            { type: 'switch', path: 'keys', labelKey: 'shorts.keys', hintKey: 'shorts.keysHint', showIf: (s) => s.enabled },
            { type: 'switch', path: 'buttons', labelKey: 'shorts.buttons', hintKey: 'shorts.buttonsHint', showIf: (s) => s.enabled },
          ],
        },
        {
          titleKey: 'shorts.sectionLook',
          showIf: (s) => s.enabled,
          controls: [
            {
              type: 'select',
              path: 'speed',
              labelKey: 'shorts.speed',
              hintKey: 'shorts.speedHint',
              options: [
                { value: 'slow', labelKey: 'shorts.speed.slow' },
                { value: 'normal', labelKey: 'shorts.speed.normal' },
                { value: 'fast', labelKey: 'shorts.speed.fast' },
              ],
            },
            { type: 'slider', path: 'scale', labelKey: 'shorts.scale', hintKey: 'shorts.scaleHint', min: 100, max: 120, step: 1, unit: '%' },
            { type: 'slider', path: 'blur', labelKey: 'shorts.blur', hintKey: 'shorts.blurHint', min: 0, max: 12, step: 1 },
          ],
        },
      ],
    },
  ],

  init() {
    // The switch shows only with the shortcut reminder, which lives in `general`
    // (and its label follows the UI language).
    on('settings:general', syncShortsSwitch);
  },

  apply: sync,
  scan: sync,
  navigate: sync,
});
