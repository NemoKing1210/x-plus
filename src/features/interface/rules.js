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

/**
 * The bordered "card" X draws around a sidebar module. Hiding only the inner
 * `aside` / `section` would leave an empty frame, so climb through wrappers
 * that hold nothing else (at most `limit` levels, never past the sidebar).
 */
function sidebarCard(node, limit = 3) {
  let card = node;
  for (let i = 0; i < limit; i += 1) {
    const parent = card.parentElement;
    if (!parent || parent.children.length !== 1 || parent.matches(SEL.sidebar)) break;
    if (parent.querySelector('form[role="search"]') && !card.querySelector('form[role="search"]')) break;
    card = parent;
  }
  return card;
}

const blocksContaining = (selector) => (root) => {
  const found = new Set();
  root.querySelectorAll(`${SEL.sidebar} ${selector}`).forEach((node) => {
    const block = sidebarBlock(node);
    if (block) found.add(sidebarCard(block));
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

/**
 * The "What is happening?" composer above the timeline: the smallest block
 * (plus its wrapper) that holds the progress bar and the inline Post button.
 * The compose dialog is left alone.
 */
function inlineComposers(root) {
  const found = new Set();
  root.querySelectorAll(`${SEL.primaryColumn} [data-testid="tweetTextarea_0"]`).forEach((input) => {
    if (input.closest('[role="dialog"]')) return;
    let block = input.parentElement;
    while (block && !block.querySelector('[role="progressbar"]')) block = block.parentElement;
    if (!block || block.closest('article')) return;
    const outer = block.parentElement;
    found.add(outer && !outer.querySelector(`${SEL.cell}, article`) ? outer : block);
  });
  return [...found];
}

/**
 * The "Show N posts" row X puts at the top of a timeline after a refresh: a
 * cell with just one button that carries a number and no post. Thread pages
 * ("Show more replies") are left alone.
 */
function showPostsRows(root) {
  if (location.pathname.includes('/status/')) return [];
  return [...root.querySelectorAll(`${SEL.primaryColumn} ${SEL.cell}`)].filter((cell) => {
    if (cell.querySelector('article')) return false;
    const button = cell.querySelector('[data-keep-composer-open] > button');
    const text = (cell.textContent || '').trim();
    return Boolean(button) && text.length <= 60 && /\d/.test(text);
  });
}

/**
 * "Discover more" on a post's page: X appends a heading cell (an `h2` and no
 * post) after the replies, followed by recommended posts. The heading is
 * localized, so it is found by structure; it and every cell after it are hidden.
 */
function moreFromX(root) {
  if (!location.pathname.includes('/status/')) return [];
  const cells = [...document.querySelectorAll(`${SEL.primaryColumn} ${SEL.cell}`)];
  const first = cells.findIndex((cell) => cell.querySelector('article'));
  const header = cells.findIndex(
    (cell, index) =>
      index > first &&
      first >= 0 &&
      !cell.querySelector('article') &&
      cell.querySelector('h2[role="heading"]'),
  );
  return header < 0 ? [] : cells.slice(header).filter((cell) => root === document || root.contains(cell) || cell.contains(root));
}

/** Feed tabs (For you / Following / …) exist on the home timeline only. */
function feedTabLists(root) {
  if (location.pathname !== '/home') return [];
  return [...root.querySelectorAll(`${SEL.primaryColumn} [role="tablist"][data-testid="ScrollSnap-List"]`)].filter(
    (list) => list.querySelector('[role="tab"]') && !list.closest('[role="dialog"]'),
  );
}

/**
 * The whole tabs block (tabs plus the "manage feeds" button): the child of the
 * floating wrapper that holds the tab list. The "new posts" pill, a sibling of
 * that block, stays.
 */
function feedTabsBlock(list) {
  const sticky = stickyAncestor(list);
  let block = list;
  if (sticky) {
    while (block.parentElement && block.parentElement !== sticky) block = block.parentElement;
  } else {
    while (block.parentElement && block.parentElement.children.length === 1 && !block.parentElement.matches(SEL.primaryColumn)) {
      block = block.parentElement;
    }
  }
  return block.querySelector(`article, ${SEL.cell}`) ? null : block;
}

/** Hide rule target: the tabs block (the "new posts" pill next to it stays). */
const feedTabs = (root) => feedTabLists(root).map(feedTabsBlock).filter(Boolean);

/** Floating wrapper of the feed tabs: the closest `position: sticky` ancestor. */
function stickyAncestor(list) {
  for (let node = list.parentElement; node && !node.matches(SEL.primaryColumn); node = node.parentElement) {
    // `data-xp-sticky` remembers a wrapper that was already un-stuck by us.
    if (node.hasAttribute('data-xp-sticky') || getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
}

export const findStickyFeedHeaders = (root) => feedTabLists(root).map(stickyAncestor).filter(Boolean);

/** @type {Rule[]} */
export const RULES = [
  /* Posts */
  { group: 'posts', key: 'feedTabs', hint: true, find: feedTabs },
  { group: 'posts', key: 'showPosts', hint: true, find: showPostsRows },
  {
    group: 'posts',
    key: 'newPostsPill',
    hint: true,
    // The slid-in wrapper of the "N new posts" pill above the timeline.
    css: 'div:has(> div > [role="status"] [data-testid="pillLabel"])',
  },
  { group: 'posts', key: 'composer', hint: true, find: inlineComposers },
  { group: 'posts', key: 'moreFromX', hint: true, find: moreFromX },
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

  /* Sidebar (right column), top to bottom */
  {
    group: 'sidebar',
    key: 'search',
    find: (root) =>
      [...root.querySelectorAll(`${SEL.sidebar} form[role="search"]`)].map((form) => sidebarCard(form, 8)),
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
    key: 'trends',
    hint: true,
    find: blocksContaining('[data-testid="trend"]'),
  },
  {
    group: 'sidebar',
    key: 'whoToFollow',
    hint: true,
    find: blocksContaining('[data-testid="UserCell"]'),
  },
  {
    group: 'sidebar',
    key: 'footer',
    hint: true,
    // Links are absolute (https://x.com/tos), so match the path suffix.
    find: (root) =>
      [...root.querySelectorAll(`${SEL.sidebar} nav[role="navigation"] a[href$="/tos"]`)]
        .map((link) => link.closest('nav'))
        .filter(Boolean)
        .map((nav) => sidebarCard(nav)),
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
  { group: 'nav', key: 'home', find: navItems('[data-testid="AppTabBar_Home_Link"]') },
  { group: 'nav', key: 'explore', find: navLinks(/^\/explore/) },
  { group: 'nav', key: 'notifications', find: navLinks(/^\/notifications/) },
  { group: 'nav', key: 'chat', find: navLinks(/^\/i\/chat/) },
  { group: 'nav', key: 'calls', find: navLinks(/^\/i\/calls/) },
  { group: 'nav', key: 'grok', find: navLinks(/^\/i\/grok/) },
  { group: 'nav', key: 'history', find: navLinks(/^\/i\/history/) },
  { group: 'nav', key: 'creatorStudio', find: navLinks(/^\/i\/jf\/creators/) },
  { group: 'nav', key: 'premium', find: navLinks(/^\/i\/premium/) },
  { group: 'nav', key: 'followerRequests', find: navLinks(/^\/follower_requests/) },
  // Our own entry (nav-button.js); General → "Sidebar button" removes it for good.
  { group: 'nav', key: 'xplus', css: 'header[role="banner"] [data-xp-nav]' },
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

  /* Floating panels (bottom right) */
  {
    group: 'chrome',
    key: 'grokDrawer',
    hint: true,
    // The slid-in wrapper around the drawer, so no gap stays behind.
    css: 'div:has(> div > [data-testid="GrokDrawer"])',
  },
  {
    group: 'chrome',
    key: 'chatDrawer',
    hint: true,
    css: 'div:has(> div > [data-testid="chat-drawer-root"])',
  },
];

export const RULE_GROUPS = ['posts', 'sidebar', 'nav', 'chrome'];

export const ruleId = (rule) => `${rule.group}.${rule.key}`;
export const ruleLabelKey = (rule) => `interface.rule.${ruleId(rule)}`;
