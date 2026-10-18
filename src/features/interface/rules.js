import { NATIVE_AUTO_TRANSLATE_ICON_PATH, SEL } from '../../core/constants.js';

/**
 * Declarative clean-up rules. A rule hides something on X and is toggled by
 * one boolean in settings (`interface[group][key]`).
 *
 * A rule supplies ONE of (fastest first)
 *   - `css`:       a selector (or a list), hidden purely with a generated stylesheet:
 *                  instant, no JS at all. Use it whenever `:has()` / `:only-child`
 *                  can express the target with shallow selectors.
 *   - `inArticle`: (article, memo) → Element[] to hide, for targets CSS cannot find
 *                  (text, climbing to a wrapper). Runs only for posts that appeared
 *                  or changed, never for the whole page; `memo` is a per-pass Map
 *                  that lets rules share work (see `mediaBlocks`).
 *   - `find`:      (root) → Element[] for page-level things outside posts (menu,
 *                  sidebar, composer, …), throttled.
 *   Matches of `inArticle` / `find` are marked `data-xp-hide~="<id>"` and hidden by
 *   the same stylesheet.
 *
 * To add a rule: append an entry here and add its label to the locales
 * (`interface.rule.<group>.<key>`). The settings UI and defaults follow.
 *
 * @typedef {object} Rule
 * @property {'posts'|'sidebar'|'nav'|'chrome'} group
 * @property {string} key
 * @property {'post'} [part]    - belongs to the Post section instead of Feed
 * @property {string} [view]    - switched by `interface.postView[view]` instead of
 *                                a "Hide" switch (and independent of the master switch)
 * @property {boolean} [on]     - enabled by default
 * @property {boolean} [hint]   - has a `…Hint` locale string
 * @property {string | string[]} [css]
 * @property {(article: Element, memo: Map<string, any>) => Element[]} [inArticle]
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
  if (article.querySelector(`svg path[d^="${AD_ICON_PATH_PREFIX}"]`)) return true;
  // Cheapest checks first: a leaf span with a short text, and only then the label set and
  // the (costly) `closest`.
  for (const span of article.querySelectorAll('span')) {
    if (span.firstElementChild || span.textContent.length > 20) continue;
    if (AD_LABELS.has(span.textContent.trim().toLowerCase()) && !span.closest(SEL.tweetText)) return true;
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

const articleCell = (article) => article.closest(SEL.cell) || article;

/** Result of `compute()` for this pass, shared between rules (see `Rule.inArticle`). */
const memoized = (memo, key, compute) => {
  if (!memo.has(key)) memo.set(key, compute());
  return memo.get(key);
};

/**
 * The card of a post quoted inside `article` that holds `node`, or null. The quote is a
 * `role="link"` block nested in the article (the article's own avatar uses the same
 * `Tweet-User-Avatar` test id, so that id cannot tell them apart).
 */
function quoteCardOf(node, article) {
  const legacy = node.closest(SEL.quoteTweet);
  if (legacy) return legacy;
  const card = node.closest('[role="link"]');
  return card && card !== article && article.contains(card) ? card : null;
}

/**
 * Posts quoted inside a post. X draws the card as a `role="link"` block that holds a
 * small avatar (`Tweet-User-Avatar`); it sits in a wrapper with the "Quote" caption, which
 * goes too so no gap stays behind. Older markup used `data-testid="quoteTweet"`.
 */
function quotedPosts(article) {
  const cards = [...article.querySelectorAll(SEL.quoteTweet)];
  for (const avatar of article.querySelectorAll(SEL.quoteAvatar)) {
    const card = quoteCardOf(avatar, article);
    if (card) cards.push(card);
  }
  return cards.map((card) => {
    const wrapper = card.parentElement;
    return wrapper && wrapper !== article && wrapper.children.length <= 2 ? wrapper : card;
  });
}

/** Avatar column of the post itself (quoted posts keep theirs). */
function avatarColumns(article) {
  const found = [];
  for (const avatar of article.querySelectorAll('[data-testid^="UserAvatar-Container"]')) {
    if (quoteCardOf(avatar, article)) continue;
    // The whole column (not just the picture), so no empty gutter stays on the left.
    let node = avatar;
    while (node.parentElement && !node.parentElement.querySelector(SEL.userName)) {
      node = node.parentElement;
      if (node === article) break;
    }
    found.push(node === article ? avatar : node);
  }
  return found;
}

/** Markers of a video / GIF inside a media block (a poster image is also a `tweetPhoto`). */
const VIDEO_MARKERS = `${SEL.videoPlayer}, [data-testid="previewInterstitial"], [data-testid="playButton"], video`;

/** What makes an ancestor too big to be "just the media": it also holds the text, name or actions. */
const POST_PARTS = `${SEL.tweetText}, ${SEL.userName}, [role="group"]`;

/**
 * Media blocks of a post (photos, videos, GIFs; also inside quotes). Each block is the largest
 * wrapper that holds nothing but media, so a photo grid goes as a whole and no empty frame
 * stays behind.
 * @returns {{ node: Element, video: boolean }[]}
 */
function mediaBlocks(article) {
  const blocks = new Map();
  for (const media of article.querySelectorAll(`:is(${SEL.photo}, ${SEL.videoPlayer})`)) {
    let node = media;
    while (node.parentElement && node.parentElement !== article && !node.parentElement.querySelector(POST_PARTS)) {
      node = node.parentElement;
    }
    blocks.set(node, blocks.get(node) || media.matches(VIDEO_MARKERS) || Boolean(media.querySelector(VIDEO_MARKERS)));
  }
  return [...blocks].map(([node, video]) => ({ node, video: video || Boolean(node.querySelector(VIDEO_MARKERS)) }));
}

const mediaOf = (article, memo, video) =>
  memoized(memo, 'media', () => mediaBlocks(article))
    .filter((block) => block.video === video)
    .map((block) => block.node);

/** The link preview card; its wrapper goes too (it also holds the "From example.com" caption). */
function linkCards(article) {
  return [...article.querySelectorAll('[data-testid="card.wrapper"]')].map((card) => {
    const wrapper = card.parentElement;
    const single = wrapper && wrapper !== article && wrapper.children.length <= 2 && !wrapper.querySelector(POST_PARTS);
    return single ? wrapper : card;
  });
}

/**
 * The X Article card: cover image plus title and teaser. Found by its cover; the card is the
 * cover's parent, and a single-child link wrapper around it goes too.
 */
function articleCards(article) {
  return [...article.querySelectorAll('[data-testid="article-cover-image"]')].map((cover) => {
    const node = cover.parentElement || cover;
    if (node === article || node.querySelector(POST_PARTS)) return cover;
    const outer = node.parentElement;
    if (outer && outer !== article && outer.children.length === 1 && !outer.querySelector(POST_PARTS)) return outer;
    return node;
  });
}

/**
 * The @handle in a post header (also in quotes), as the largest wrapper that holds nothing else,
 * plus the "·" separator right after it so no dangling dot stays before the time.
 */
function handleLabels(article) {
  const found = [];
  for (const header of article.querySelectorAll(SEL.userName)) {
    for (const span of header.querySelectorAll('span')) {
      if (span.firstElementChild) continue;
      const text = span.textContent.trim();
      if (text.charCodeAt(0) !== 64) continue; // "@"
      let node = span;
      while (node.parentElement && node.parentElement !== header && node.parentElement.textContent.trim() === text) {
        node = node.parentElement;
      }
      found.push(node);
      const next = node.nextElementSibling;
      if (next && next.textContent.trim() === '·') found.push(next);
    }
  }
  return found;
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
  const known = list.closest('[data-xp-sticky]');
  if (known) return known;
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
    inArticle: (article) => (isPromotedArticle(article) ? [articleCell(article)] : []),
  },
  {
    group: 'posts',
    key: 'viewCounts',
    part: 'post',
    hint: true,
    // The analytics link is a child of the action bar's slot; hide that slot.
    css: `${SEL.article} [role="group"] > div:has(> a[href$="/analytics"])`,
  },
  {
    group: 'posts',
    key: 'avatars',
    view: 'hideAvatars',
    hint: true,
    inArticle: avatarColumns,
  },
  { group: 'posts', key: 'images', part: 'post', hint: true, inArticle: (a, memo) => mediaOf(a, memo, false) },
  { group: 'posts', key: 'videos', part: 'post', hint: true, inArticle: (a, memo) => mediaOf(a, memo, true) },
  { group: 'posts', key: 'linkCards', part: 'post', hint: true, inArticle: linkCards },
  { group: 'posts', key: 'articles', part: 'post', hint: true, inArticle: articleCards },
  {
    group: 'posts',
    key: 'translateNotice',
    part: 'post',
    hint: true,
    // X's "Source language: … Show original" line: the div that holds the translate glyph and a
    // button. The same glyph sits inside the Grok header button (no button sibling there), and
    // our own translate chrome is excluded.
    css: `${SEL.article} div:not([data-xp-ui], [data-xp-ui] *):has(> svg path[d^="${NATIVE_AUTO_TRANSLATE_ICON_PATH}"]):has(> button)`,
  },
  { group: 'posts', key: 'handles', part: 'post', hint: true, inArticle: handleLabels },
  { group: 'posts', key: 'quotedPosts', part: 'post', hint: true, inArticle: quotedPosts },
  {
    group: 'posts',
    key: 'actionBar',
    part: 'post',
    hint: true,
    // The reply / repost / like row, plus up to two single-child wrappers so no gap stays behind.
    css: [
      `${SEL.article} [role="group"]:has(> div > ${SEL.actionReply})`,
      `${SEL.article} div:has(> [role="group"]:only-child > div > ${SEL.actionReply})`,
      `${SEL.article} div:has(> div:only-child > [role="group"]:only-child > div > ${SEL.actionReply})`,
    ],
  },
  {
    group: 'posts',
    key: 'verifiedBadges',
    part: 'post',
    hint: true,
    css: '[data-testid="icon-verified"]',
  },
  {
    group: 'posts',
    key: 'grokButton',
    part: 'post',
    hint: true,
    css: `${SEL.article} div:has(> button[aria-label*="grok" i])`,
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
