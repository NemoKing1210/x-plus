import { SEL } from '../../core/constants.js';

/**
 * Declarative clean-up rules. A rule hides something on X and is toggled by
 * one boolean in settings (`interface[group][key]`).
 *
 * A rule supplies EITHER
 *   - `css`:  a selector, hidden purely with a generated stylesheet (cheap,
 *             instant on/off), OR
 *   - `find`: (root) → Element[] to hide, for things CSS cannot express
 *             reliably; matches are marked `data-xp-hide~="<id>"` and hidden by
 *             the same stylesheet.
 *
 * To add a rule: append an entry here and add its label to the locales
 * (`interface.rule.<group>.<key>`). The settings UI and defaults follow.
 *
 * @typedef {object} Rule
 * @property {'posts'|'sidebar'|'nav'|'chrome'} group
 * @property {string} key
 * @property {boolean} [on]     - enabled by default
 * @property {boolean} [hint]   - has a `…Hint` locale string
 * @property {string} [css]
 * @property {(root: ParentNode) => Element[]} [find]
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Labels X uses for promoted posts, lower-case (the ones we know of). */
const AD_LABELS = new Set([
  'ad',
  'promoted',
  'реклама',
  'anzeige',
  'anuncio',
  'annonce',
  'publicité',
  'publicidade',
  'pubblicità',
  'promowane',
  'reklama',
  'reklam',
  '広告',
  '广告',
  '廣告',
  '광고',
]);

/** Path prefix of the "Ad" rectangle glyph X draws next to promoted posts. */
const AD_ICON_PATH_PREFIX = 'M19.498 3h-15c-1.381';

function isPromotedArticle(article) {
  for (const path of article.querySelectorAll('svg path[d]')) {
    if ((path.getAttribute('d') || '').startsWith(AD_ICON_PATH_PREFIX)) return true;
  }
  for (const span of article.querySelectorAll('span')) {
    if (span.closest(SEL.tweetText)) continue;
    const text = (span.textContent || '').trim().toLowerCase();
    if (text.length <= 14 && AD_LABELS.has(text) && !span.children.length) return true;
  }
  return false;
}

/**
 * Smallest sidebar block that contains `node`: X renders each sidebar module
 * (Who to follow, Trends, Premium card, …) as an `aside` / `section`.
 */
function sidebarBlock(node) {
  const sidebar = node.closest(SEL.sidebar);
  if (!sidebar) return null;
  const block = node.closest('aside, section, [role="complementary"], [role="region"]');
  return block && sidebar.contains(block) ? block : null;
}

const blocksContaining = (selector) => (root) => {
  const found = new Set();
  root.querySelectorAll(`${SEL.sidebar} ${selector}`).forEach((node) => {
    const block = sidebarBlock(node);
    if (block) found.add(block);
  });
  return [...found];
};

/** Left-navigation links whose path matches. */
const navLinks = (pattern) => (root) =>
  [...root.querySelectorAll('header[role="banner"] a[href]')].filter((a) =>
    pattern.test(a.getAttribute('href') || ''),
  );

/** Left-navigation entries matched by selector (profile link, "More" button). */
const navItems = (selector) => (root) => [
  ...root.querySelectorAll(`header[role="banner"] ${selector}`),
];

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/** @type {Rule[]} */
export const RULES = [
  /* Posts */
  {
    group: 'posts',
    key: 'promoted',
    on: true,
    hint: true,
    find: (root) =>
      [...root.querySelectorAll(SEL.article)]
        .filter(isPromotedArticle)
        .map((article) => article.closest(SEL.cell) || article),
  },
  {
    group: 'posts',
    key: 'viewCounts',
    hint: true,
    find: (root) =>
      [...root.querySelectorAll(`${SEL.article} a[href$="/analytics"]`)].map((link) => {
        const group = link.closest('[role="group"]');
        let node = link;
        while (group && node.parentElement && node.parentElement !== group) node = node.parentElement;
        return node;
      }),
  },
  {
    group: 'posts',
    key: 'verifiedBadges',
    hint: true,
    css: '[data-testid="icon-verified"]',
  },
  {
    group: 'posts',
    key: 'grokButton',
    hint: true,
    find: (root) =>
      [...root.querySelectorAll(`${SEL.article} button[aria-label*="grok" i]`)]
        .map((button) => button.parentElement)
        .filter(Boolean),
  },

  /* Sidebar */
  {
    group: 'sidebar',
    key: 'whoToFollow',
    hint: true,
    find: blocksContaining('[data-testid="UserCell"]'),
  },
  {
    group: 'sidebar',
    key: 'trends',
    hint: true,
    find: blocksContaining('[data-testid="trend"]'),
  },
  {
    group: 'sidebar',
    key: 'premium',
    on: true,
    hint: true,
    find: blocksContaining('a[href*="premium_sign_up"], a[href^="/i/premium"]'),
  },
  {
    group: 'sidebar',
    key: 'footer',
    hint: true,
    find: (root) =>
      [...root.querySelectorAll(`${SEL.sidebar} a[href="/tos"]`)]
        .map((link) => link.closest('nav'))
        .filter(Boolean),
  },

  /* Navigation (left menu) */
  {
    group: 'nav',
    key: 'logo',
    // The wrapper around the <h1> too, so no empty gap stays above the menu.
    find: (root) =>
      navItems('h1 a[href="/home"]')(root).map((link) => {
        const heading = link.closest('h1');
        return heading?.parentElement || heading || link;
      }),
  },
  { group: 'nav', key: 'explore', find: navLinks(/^\/explore/) },
  { group: 'nav', key: 'notifications', find: navLinks(/^\/notifications/) },
  { group: 'nav', key: 'chat', find: navLinks(/^\/i\/chat/) },
  { group: 'nav', key: 'calls', find: navLinks(/^\/i\/calls/) },
  { group: 'nav', key: 'grok', find: navLinks(/^\/i\/grok/) },
  { group: 'nav', key: 'history', find: navLinks(/^\/i\/history/) },
  { group: 'nav', key: 'creatorStudio', find: navLinks(/^\/i\/jf\/creators/) },
  { group: 'nav', key: 'premium', find: navLinks(/^\/i\/premium/) },
  { group: 'nav', key: 'followerRequests', find: navLinks(/^\/follower_requests/) },
  { group: 'nav', key: 'profile', find: navItems('[data-testid="AppTabBar_Profile_Link"]') },
  { group: 'nav', key: 'more', find: navItems('[data-testid="AppTabBar_More_Menu"]') },
  {
    group: 'nav',
    key: 'post',
    // Hide the button's wrapper too, so no empty gap stays in the menu.
    find: (root) =>
      navItems('[data-testid="SideNav_NewTweet_Button"]')(root).map((button) => button.parentElement || button),
  },
  {
    group: 'nav',
    key: 'account',
    // Account switcher at the bottom: hide its wrappers too, but never the nav.
    find: (root) =>
      navItems('[data-testid="SideNav_AccountSwitcher_Button"]')(root).map((button) => {
        const outer = button.parentElement?.parentElement;
        if (outer && !outer.querySelector('nav')) return outer;
        return button.parentElement || button;
      }),
  },

  /* Interface chrome */
  {
    group: 'chrome',
    key: 'messagesDrawer',
    hint: true,
    css: '[data-testid="DMDrawer"]',
  },
];

export const RULE_GROUPS = ['posts', 'sidebar', 'nav', 'chrome'];

export const ruleId = (rule) => `${rule.group}.${rule.key}`;
export const ruleLabelKey = (rule) => `interface.rule.${ruleId(rule)}`;
