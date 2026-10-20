import { LOCALE_FLAG_AUTO, t } from '../../i18n/index.js';
import { showToast } from '../../ui/toast.js';
import { el } from '../../utils/dom.js';
import { fmt, formatBytes } from '../../utils/format.js';
import { normalizeLangCode } from '../../utils/lists.js';
import {
  createButton,
  createButtonRow,
  createMeter,
  createRow,
  createSelect,
  createTextInput,
} from '../settings/controls.js';
import { CACHE_HOURS_MAX, cacheFillLevel, clearCache, getCacheUsageStats } from './cache.js';
import { TARGET_LANGUAGES } from './languages.js';
import { TRANSLATION_PROVIDERS } from './providers/registry.js';

/**
 * Settings tabs of the translation feature (Translation incl. provider, Cache).
 * Everything declarative goes through the shared spec renderer; the provider
 * fields and the cache meter are custom controls.
 */

const tr = (key, vars) => t(`translate.${key}`, vars);

const targetLangOptions = () => [
  { value: 'auto', label: `${LOCALE_FLAG_AUTO} ${tr('langAuto')}` },
  ...TARGET_LANGUAGES.map((lang) => ({
    value: lang.code,
    label: `${lang.flag} ${lang.name}`,
  })),
];

function langLabel(code) {
  const normalized = normalizeLangCode(code);
  const row = TARGET_LANGUAGES.find((lang) => normalizeLangCode(lang.code) === normalized);
  return row ? `${row.flag} ${row.name}` : code;
}

/** Language picker for the allow/block lists: languages not selected yet. */
function langPickerOptions(selected = []) {
  const taken = new Set(selected.map(normalizeLangCode));
  return TARGET_LANGUAGES.filter((lang) => !taken.has(normalizeLangCode(lang.code))).map(
    (lang) => ({ value: normalizeLangCode(lang.code), label: `${lang.flag} ${lang.name}` }),
  );
}

function targetBadge(targetLang) {
  if (!targetLang || targetLang === 'auto') return `${LOCALE_FLAG_AUTO} ${tr('badgeLangAuto')}`;
  const row =
    TARGET_LANGUAGES.find((lang) => lang.code === targetLang) ||
    (targetLang === 'zh' ? TARGET_LANGUAGES.find((lang) => lang.code === 'zh-CN') : null);
  return row ? `${row.flag} ${row.code}` : targetLang;
}

function cacheBadge(draft) {
  const stats = getCacheUsageStats(draft.translate.cacheHours);
  if (!stats.enabled) return tr('badgeCacheOff');
  const pct = stats.pct < 10 && stats.pct > 0 ? stats.pct.toFixed(1) : String(Math.round(stats.pct));
  return `${pct}%`;
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

function renderProviderFields(ctx) {
  const root = el('div', 'xp-provider-panels');
  const blocks = new Map();

  for (const provider of TRANSLATION_PROVIDERS) {
    const block = el('div', 'xp-provider-fields');
    const config = ctx.section.providerConfig[provider.id];

    for (const spec of provider.fields) {
      const common = {
        label: t(spec.labelKey),
        hint: spec.hintKey ? t(spec.hintKey) : '',
        value: config[spec.key],
        onChange: (value) => {
          config[spec.key] = value;
          ctx.changed();
        },
      };
      const control =
        spec.type === 'select'
          ? createSelect({
              ...common,
              options: spec.options.map((o) => ({ value: o.value, label: t(o.labelKey) })),
            })
          : createTextInput({
              ...common,
              type: spec.type === 'password' ? 'password' : spec.type === 'url' ? 'url' : 'text',
              placeholder: spec.placeholder,
            });
      block.appendChild(control.row);
    }
    block.appendChild(el('p', 'xp-hint', t(provider.hintKey)));
    blocks.set(provider.id, block);
    root.appendChild(block);
  }

  const sync = () => {
    for (const [id, block] of blocks) block.hidden = id !== ctx.section.provider;
  };
  ctx.subscribe(sync);
  sync();
  return root;
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

function paintMeter(root, hours) {
  const stats = getCacheUsageStats(hours);
  const level = cacheFillLevel(stats);
  const pct = `${stats.pct < 10 && stats.pct > 0 ? stats.pct.toFixed(1) : Math.round(stats.pct)}%`;
  const limits = { used: formatBytes(stats.usedBytes), limit: formatBytes(stats.limitBytes) };
  const ttl = stats.enabled ? fmt(tr('cacheMeterTtl'), { hours: stats.ttlHours }) : tr('cacheMeterDisabled');

  root.dataset.level = level;
  root.querySelector('.xp-meter__pct').textContent = pct;
  root.querySelector('.xp-meter__used').textContent = fmt(tr('cacheMeterUsed'), limits);
  const bar = root.querySelector('.xp-meter__bar');
  bar.setAttribute('aria-valuenow', String(Math.round(stats.pct)));
  bar.setAttribute(
    'aria-label',
    fmt(tr('cacheMeterAria'), { ...limits, pct, count: stats.entryCount }),
  );
  root.querySelector('.xp-meter__fill').style.width = `${Math.max(stats.pct > 0 ? 1.5 : 0, stats.pct)}%`;
  root.querySelector('.xp-meter__meta').textContent = [
    fmt(tr('cacheMeterEntries'), { count: stats.entryCount }),
    ttl,
    fmt(tr('cacheMeterFree'), { free: formatBytes(stats.freeBytes) }),
  ].join(' · ');
  root.querySelector('.xp-meter__hint').textContent = tr('cacheMeterHint');
}

function renderCacheMeter(ctx) {
  const meter = createMeter({ title: tr('cacheMeterTitle') });
  const row = createRow();
  row.appendChild(meter);
  const repaint = () => paintMeter(meter, ctx.section.cacheHours);
  ctx.subscribe(repaint);
  repaint();
  return row;
}

function renderClearCache(ctx) {
  return createButtonRow(
    createButton({
      label: tr('settingsClearCache'),
      variant: 'danger',
      onClick: () => {
        clearCache();
        ctx.changed();
        showToast(tr('settingsCacheCleared'), { type: 'info' });
      },
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const isAuto = (s) => s.translateMode === 'auto';
const isAllowlistScope = (s) => isAuto(s) && s.autoScope === 'allowlist';

const allTabs = [
  {
    id: 'translate',
    titleKey: 'translate.sectionTranslation',
    badge: (draft) => targetBadge(draft.translate.targetLang),
    sections: [
      {
        titleKey: 'translate.sectionMain',
        controls: [
          { type: 'switch', path: 'enabled', labelKey: 'translate.enabled', hintKey: 'translate.enabledHint' },
          {
            type: 'switch',
            path: 'articles',
            labelKey: 'translate.articles',
            hintKey: 'translate.articlesHint',
            showIf: (s) => s.enabled,
          },
        ],
      },
      {
        titleKey: 'translate.settingsSectionTranslate',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'select',
            path: 'targetLang',
            labelKey: 'translate.settingsTargetLang',
            options: targetLangOptions,
          },
          {
            type: 'select',
            path: 'translateMode',
            labelKey: 'translate.settingsTranslateMode',
            hintKey: 'translate.settingsTranslateModeHint',
            options: [
              { value: 'button', labelKey: 'translate.translateModeButton' },
              { value: 'auto', labelKey: 'translate.translateModeAuto' },
            ],
          },
          {
            type: 'select',
            path: 'autoScope',
            labelKey: 'translate.settingsAutoScope',
            hintKey: 'translate.settingsAutoScopeHint',
            options: [
              { value: 'all', labelKey: 'translate.autoScopeAll' },
              { value: 'allowlist', labelKey: 'translate.autoScopeAllowlist' },
            ],
            showIf: isAuto,
          },
          {
            type: 'list',
            kind: 'handle',
            path: 'autoAllowlist',
            titleKey: 'translate.autoScopeAllowlist',
            hintKey: 'translate.settingsAllowlistHint',
            placeholderKey: 'translate.allowlistPlaceholder',
            addKey: 'translate.allowlistAdd',
            emptyKey: 'translate.allowlistEmpty',
            showIf: isAllowlistScope,
          },
          {
            type: 'select',
            path: 'displayMode',
            labelKey: 'translate.settingsDisplayMode',
            hintKey: 'translate.settingsDisplayModeHint',
            options: [
              { value: 'panel', labelKey: 'translate.displayModePanel' },
              { value: 'replace', labelKey: 'translate.displayModeReplace' },
            ],
          },
          {
            type: 'select',
            path: 'replaceReveal',
            labelKey: 'translate.settingsReplaceReveal',
            hintKey: 'translate.settingsReplaceRevealHint',
            options: [
              { value: 'button', labelKey: 'translate.replaceRevealButton' },
              { value: 'hover', labelKey: 'translate.replaceRevealHover' },
              { value: 'split', labelKey: 'translate.replaceRevealSplit' },
            ],
            showIf: (s) => s.displayMode === 'replace',
          },
          {
            type: 'switch',
            path: 'skipNativeAutoTranslate',
            labelKey: 'translate.settingsSkipNative',
            hintKey: 'translate.settingsSkipNativeHint',
          },
          {
            type: 'switch',
            path: 'hideErrors',
            labelKey: 'translate.settingsHideErrors',
            hintKey: 'translate.settingsHideErrorsHint',
          },
        ],
      },
      {
        titleKey: 'translate.settingsSectionProvider',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'select',
            path: 'provider',
            labelKey: 'translate.settingsProvider',
            hintKey: 'translate.settingsProviderHint',
            options: TRANSLATION_PROVIDERS.map((p) => ({ value: p.id, label: p.name })),
          },
          { type: 'custom', render: renderProviderFields },
        ],
      },
      {
        titleKey: 'translate.settingsSectionAccounts',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'list',
            kind: 'handle',
            path: 'accountBlocklist',
            titleKey: 'translate.settingsAccountBlocklist',
            hintKey: 'translate.settingsAccountBlocklistHint',
            placeholderKey: 'translate.allowlistPlaceholder',
            addKey: 'translate.allowlistAdd',
            emptyKey: 'translate.blocklistEmpty',
          },
        ],
      },
      {
        titleKey: 'translate.settingsSectionLanguages',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'list',
            kind: 'lang',
            path: 'langAllowlist',
            titleKey: 'translate.settingsLangAllowlist',
            hintKey: 'translate.settingsLangAllowlistHint',
            addKey: 'translate.langListAdd',
            emptyKey: 'translate.langListEmpty',
            formatItem: langLabel,
            pickerOptions: langPickerOptions,
          },
          {
            type: 'list',
            kind: 'lang',
            path: 'langBlocklist',
            titleKey: 'translate.settingsLangBlocklist',
            hintKey: 'translate.settingsLangBlocklistHint',
            addKey: 'translate.langListAdd',
            emptyKey: 'translate.langListEmpty',
            formatItem: langLabel,
            pickerOptions: langPickerOptions,
          },
        ],
      },
    ],
  },
  {
    id: 'translate-cache',
    titleKey: 'translate.sectionCache',
    badge: cacheBadge,
    sections: [
      {
        titleKey: 'translate.settingsSectionCache',
        controls: [
          { type: 'custom', render: renderCacheMeter },
          {
            type: 'number',
            path: 'cacheHours',
            labelKey: 'translate.settingsCacheHours',
            hintKey: 'translate.settingsCacheHint',
            min: 0,
            max: CACHE_HOURS_MAX,
          },
          { type: 'custom', render: renderClearCache },
        ],
      },
    ],
  },
];

export const translateTabs = allTabs.filter((tab) => tab.id !== 'translate-cache');
/** Listed by the settings feature so the tab sits right before Backup. */
export const cacheTab = allTabs.find((tab) => tab.id === 'translate-cache');
