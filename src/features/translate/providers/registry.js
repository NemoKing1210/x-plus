import { field } from '../../../core/schema.js';

/**
 * Translation provider registry: ids, labels, settings fields and defaults.
 * Field `type`: text | password | url | select.
 *
 * To add a provider: describe it here, implement `translateWith<Name>` in its
 * own file, and wire it in `../api.js`. Declare any new host in
 * `vite.config.js` `@connect`.
 *
 * @typedef {{ value: string, labelKey: string }} ProviderSelectOption
 * @typedef {{
 *   key: string,
 *   type: 'text' | 'password' | 'url' | 'select',
 *   labelKey: string,
 *   hintKey?: string,
 *   placeholder?: string,
 *   required?: boolean,
 *   default?: string,
 *   options?: ProviderSelectOption[],
 * }} ProviderField
 */

/** @type {ReadonlyArray<{ id: string, name: string, badge: string, hintKey: string, fields: ProviderField[] }>} */
export const TRANSLATION_PROVIDERS = Object.freeze([
  {
    id: 'google',
    name: 'Google Translate',
    badge: 'Google',
    hintKey: 'translate.providerHintGoogle',
    fields: [],
  },
  {
    id: 'deepl',
    name: 'DeepL',
    badge: 'DeepL',
    hintKey: 'translate.providerHintDeepl',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'translate.providerFieldApiKey',
        hintKey: 'translate.providerHintDeeplKey',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx',
        required: true,
        default: '',
      },
      {
        key: 'plan',
        type: 'select',
        labelKey: 'translate.providerFieldDeeplPlan',
        default: 'free',
        options: [
          { value: 'free', labelKey: 'translate.providerDeeplPlanFree' },
          { value: 'pro', labelKey: 'translate.providerDeeplPlanPro' },
        ],
      },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft Translator',
    badge: 'Azure',
    hintKey: 'translate.providerHintMicrosoft',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'translate.providerFieldApiKey',
        required: true,
        default: '',
      },
      {
        key: 'region',
        type: 'text',
        labelKey: 'translate.providerFieldRegion',
        hintKey: 'translate.providerHintMicrosoftRegion',
        placeholder: 'global',
        required: true,
        default: 'global',
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'OpenAI',
    hintKey: 'translate.providerHintOpenai',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'translate.providerFieldApiKey',
        required: true,
        default: '',
      },
      {
        key: 'model',
        type: 'text',
        labelKey: 'translate.providerFieldModel',
        placeholder: 'gpt-4o-mini',
        default: 'gpt-4o-mini',
      },
      {
        key: 'baseUrl',
        type: 'url',
        labelKey: 'translate.providerFieldBaseUrl',
        hintKey: 'translate.providerHintOpenaiBase',
        placeholder: 'https://api.openai.com/v1',
        default: 'https://api.openai.com/v1',
      },
    ],
  },
  {
    id: 'yandex',
    name: 'Yandex Translate',
    badge: 'Yandex',
    hintKey: 'translate.providerHintYandex',
    fields: [
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'translate.providerFieldApiKey',
        required: true,
        default: '',
      },
      {
        key: 'folderId',
        type: 'text',
        labelKey: 'translate.providerFieldFolderId',
        hintKey: 'translate.providerHintYandexFolder',
        required: true,
        default: '',
      },
    ],
  },
  {
    id: 'libretranslate',
    name: 'LibreTranslate',
    badge: 'Libre',
    hintKey: 'translate.providerHintLibre',
    fields: [
      {
        key: 'apiUrl',
        type: 'url',
        labelKey: 'translate.providerFieldApiUrl',
        placeholder: 'https://libretranslate.com',
        required: true,
        default: 'https://libretranslate.com',
      },
      {
        key: 'apiKey',
        type: 'password',
        labelKey: 'translate.providerFieldApiKeyOptional',
        default: '',
      },
    ],
  },
]);

export const PROVIDER_IDS = Object.freeze(TRANSLATION_PROVIDERS.map((p) => p.id));

export function getProvider(id) {
  return TRANSLATION_PROVIDERS.find((p) => p.id === id) || TRANSLATION_PROVIDERS[0];
}

export function isKnownProvider(id) {
  return PROVIDER_IDS.includes(id);
}

/** Settings schema for `providerConfig`, derived from the registry above. */
export function providerConfigSchema() {
  const perProvider = {};
  for (const provider of TRANSLATION_PROVIDERS) {
    const fields = {};
    for (const f of provider.fields) {
      fields[f.key] =
        f.type === 'select'
          ? field.enum(
              f.options.map((o) => o.value),
              f.default,
            )
          : field.text(f.default ?? '', { max: 500 });
    }
    perProvider[provider.id] = field.record(fields);
  }
  return field.record(perProvider);
}
