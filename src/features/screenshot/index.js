import { on } from '../../core/bus.js';
import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { BACKGROUND_MODES } from './background.js';
import { removeAllButtons, scanButtons } from './button.js';
import { SCALE_MODES } from './naming.js';

/** Select options whose labels live at `screenshot.<prefix>.<value>`. */
const optionsFor = (prefix, values) =>
  values.map((value) => ({ value, labelKey: `screenshot.${prefix}.${value}` }));

/**
 * Post screenshots: a camera button in the post header opens a capture menu —
 * copy the post as a PNG, save it as PNG / JPEG, or copy its text and link —
 * with quick background, scale and action-row options. Off by default.
 */
registerFeature({
  id: 'screenshot',
  order: 15,

  fields: {
    /** Master switch for the whole feature. */
    enabled: field.bool(false),
    /** Click opens the capture menu instead of copying straight away. */
    menu: field.bool(true),
    /** `theme` follows X's page background; the rest force a color (or none). */
    background: field.enum(BACKGROUND_MODES, 'theme'),
    /** Used when `background` is `custom`; invalid values fall back to the theme. */
    customBackground: field.text('#000000', { max: 40 }),
    /** `auto` = device pixel ratio clamped to 2–3×. */
    scale: field.enum(SCALE_MODES, 'auto'),
    /** Keep the reply / repost / like / views row in the image. */
    actions: field.bool(true),
    /** Save the PNG instead of copying it (used when the menu is off). */
    save: field.bool(false),
  },

  tabs: [
    {
      id: 'screenshot',
      titleKey: 'screenshot.title',
      badge: (draft) => (draft.screenshot.enabled ? '' : t('common.off')),
      sections: [
        {
          titleKey: 'screenshot.sectionMain',
          descKey: 'screenshot.sectionMainDesc',
          controls: [
            {
              type: 'switch',
              path: 'enabled',
              labelKey: 'screenshot.enabled',
              hintKey: 'screenshot.enabledHint',
            },
            {
              type: 'switch',
              path: 'menu',
              labelKey: 'screenshot.menu',
              hintKey: 'screenshot.menuHint',
              showIf: (section) => section.enabled,
            },
            {
              type: 'switch',
              path: 'save',
              labelKey: 'screenshot.save',
              hintKey: 'screenshot.saveHint',
              showIf: (section) => section.enabled && !section.menu,
            },
          ],
        },
        {
          titleKey: 'screenshot.sectionAppearance',
          descKey: 'screenshot.sectionAppearanceDesc',
          showIf: (section) => section.enabled,
          controls: [
            {
              type: 'select',
              path: 'background',
              labelKey: 'screenshot.background',
              hintKey: 'screenshot.backgroundHint',
              options: optionsFor('background', BACKGROUND_MODES),
            },
            {
              type: 'text',
              path: 'customBackground',
              labelKey: 'screenshot.customBackground',
              hintKey: 'screenshot.customBackgroundHint',
              placeholder: '#000000',
              showIf: (section) => section.background === 'custom',
            },
            {
              type: 'select',
              path: 'scale',
              labelKey: 'screenshot.scale',
              hintKey: 'screenshot.scaleHint',
              options: optionsFor('scale', SCALE_MODES),
            },
          ],
        },
        {
          titleKey: 'screenshot.sectionContent',
          descKey: 'screenshot.sectionContentDesc',
          showIf: (section) => section.enabled,
          controls: [
            {
              type: 'switch',
              path: 'actions',
              labelKey: 'screenshot.actions',
              hintKey: 'screenshot.actionsHint',
            },
          ],
        },
      ],
    },
  ],

  init() {
    // Translate's apply re-inserts its wrapper before Grok; re-order ours
    // after it so the two controls stay adjacent whichever one changed.
    on('settings:translate', scanButtons);
  },

  apply(settings) {
    if (!settings.enabled) removeAllButtons();
    else scanButtons();
  },

  scan() {
    scanButtons();
  },

  navigate() {
    scanButtons();
  },
});
