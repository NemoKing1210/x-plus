import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { scanArticles, teardownArticles } from './article.js';
import { persistCacheNow, CACHE_HOURS_MAX } from './cache.js';
import { scanPosts } from './controller.js';
import { TARGET_LANGUAGES } from './languages.js';
import { observePostMenus } from './post-menu.js';
import { PROVIDER_IDS, providerConfigSchema } from './providers/registry.js';
import { translateTabs } from './settings.js';

/**
 * In-place post translation. Adds a Translate control to every post and reply
 * (button or automatic), renders the result in a panel or in place of the
 * original text, and caches results per provider / language / text.
 */
registerFeature({
  id: 'translate',
  order: 10,

  fields: {
    /** Master switch for the whole feature. */
    enabled: field.bool(true),
    /** Translate X Articles (long-form posts) block by block. */
    articles: field.bool(true),
    /** Provider id from the provider registry. */
    provider: field.enum(PROVIDER_IDS, 'google'),
    providerConfig: providerConfigSchema(),
    /** Translation target: `auto` (UI / browser language) or a Google Translate code. */
    targetLang: field.enum(() => ['auto', 'zh', ...TARGET_LANGUAGES.map((l) => l.code)], 'auto'),
    /** `button` = Translate on click; `auto` = translate when the post enters the viewport. */
    translateMode: field.enum(['button', 'auto'], 'button'),
    /** `panel` = result below the post; `replace` = swap the post text in place. */
    displayMode: field.enum(['panel', 'replace'], 'replace'),
    /** Replace mode: `button` = Show original; `hover` = peek original; `split` = both together. */
    replaceReveal: field.enum(['button', 'hover', 'split'], 'button'),
    /** Auto mode scope: every visible post, or only listed accounts. */
    autoScope: field.enum(['all', 'allowlist'], 'all'),
    autoAllowlist: field.list('handle'),
    /** Never show Translate / never auto-translate these accounts. */
    accountBlocklist: field.list('handle'),
    /** If non-empty, only translate when the detected source is in this list. */
    langAllowlist: field.list('lang'),
    /** Skip translation when the detected source is in this list. */
    langBlocklist: field.list('lang'),
    /** Skip posts that already show X's built-in auto-translation bar. */
    skipNativeAutoTranslate: field.bool(true),
    /** Don't show the "Translation failed" message (the post stays untranslated). */
    hideErrors: field.bool(true),
    /** Cache lifetime in hours; 0 disables the cache. */
    cacheHours: field.int(24, { min: 0, max: CACHE_HOURS_MAX }),
  },

  tabs: translateTabs,

  init() {
    window.addEventListener('pagehide', persistCacheNow);
    observePostMenus();
  },

  apply() {
    scanPosts();
    scanArticles();
  },

  scan() {
    scanPosts();
    scanArticles();
  },

  navigate() {
    // A new page may reuse DOM nodes: drop article state, then rebuild it.
    teardownArticles();
    scanArticles();
  },
});
