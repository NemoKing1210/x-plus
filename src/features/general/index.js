import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import {
  configureLocale,
  LOCALE_FLAGS,
  LOCALE_FLAG_AUTO,
  LOCALE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  t,
} from '../../i18n/index.js';

const TOAST_POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

function languageOptions() {
  return [
    { value: 'auto', label: `${LOCALE_FLAG_AUTO} ${t('general.languageAuto')}` },
    ...SUPPORTED_LOCALES.map((code) => ({
      value: code,
      label: `${LOCALE_FLAGS[code]} ${LOCALE_NATIVE_NAMES[code]}`,
    })),
  ];
}

/** Script-wide settings: UI language, sidebar entry, toast notifications. */
registerFeature({
  id: 'general',
  order: 0,

  fields: {
    language: field.enum(['auto', ...SUPPORTED_LOCALES], 'auto'),
    navButton: field.bool(true),
    toastsEnabled: field.bool(true),
    toastPosition: field.enum(TOAST_POSITIONS, 'top-right'),
    /** Seconds; 0 keeps toasts until dismissed. */
    toastDuration: field.int(5, { min: 0, max: 120 }),
  },

  tabs: [
    {
      id: 'general',
      titleKey: 'general.title',
      sections: [
        {
          titleKey: 'general.sectionInterface',
          controls: [
            {
              type: 'select',
              path: 'language',
              labelKey: 'general.language',
              hintKey: 'general.languageHint',
              options: languageOptions,
            },
            {
              type: 'switch',
              path: 'navButton',
              labelKey: 'general.navButton',
              hintKey: 'general.navButtonHint',
            },
          ],
        },
        {
          titleKey: 'general.sectionToasts',
          controls: [
            {
              type: 'switch',
              path: 'toastsEnabled',
              labelKey: 'general.toasts',
              hintKey: 'general.toastsHint',
            },
            {
              type: 'select',
              path: 'toastPosition',
              labelKey: 'general.toastPosition',
              options: TOAST_POSITIONS.map((value) => ({
                value,
                labelKey: `general.toastPosition.${value}`,
              })),
              showIf: (section) => section.toastsEnabled,
            },
            {
              type: 'number',
              path: 'toastDuration',
              labelKey: 'general.toastDuration',
              hintKey: 'general.toastDurationHint',
              min: 0,
              max: 120,
              showIf: (section) => section.toastsEnabled,
            },
          ],
        },
      ],
    },
  ],

  apply(cfg) {
    configureLocale(cfg.language);
  },
});
