import { cssFor, dom } from '../../core/compat/index.js';

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

/** Promoted posts, detected by the DOM profile. */
const isPromotedArticle = (article) => dom.isPromotedArticle(article);

/* CSS fragments of the page chrome, as `:is(legacy, modern)` unions. */
const CELL = cssFor('cell');
const USER_CELL = cssFor('userCell');
const PRIMARY_COLUMN = cssFor('primaryColumn');
const SHOW_POSTS_BUTTON = cssFor('showPostsButton');

/** A finder that needs a fragment; without one (a profile does not know it) it finds nothing. */
const onFragment = (key, build) => {
  const fragment = cssFor(key);
  return fragment ? build(fragment) : () => [];
};

/** Whether `:has()` may wrap this fragment: it must not carry one of its own. */
const canWrap = (selector) => Boolean(selector) && !selector.includes(':has(');

/** The wrapper X slides in around floating page chrome; empty when no profile knows it. */
const slidIn = (key, inner) => {
  const marker = cssFor(key);
  if (!marker) return '';
  const target = inner(marker);
  return canWrap(target) ? `div:has(> div > ${target})` : target;
};

/**
 * A floating drawer: on the legacy build the marker sits inside the wrapper X
 * slides in (hide the wrapper too, so no gap stays behind); on the modern build
 * the dock window is the thing to hide. The wrapper is a profile fragment, so
 * a `:has()`-carrying marker is never nested inside another `:has()`.
 */
export const drawerCss = (key) => {
  const marker = cssFor(key);
  const wrapper = cssFor(`${key}Wrapper`);
  return [wrapper, marker].filter(Boolean);
};

/** Sidebar cards around the first block that contains a `selector` match. */
const blocksContaining = (selector) => (root) => {
  const sidebar = dom.getSidebar(root);
  if (!sidebar) return [];
  const found = new Set();
  sidebar.querySelectorAll(selector).forEach((node) => {
    const block = dom.getSidebarBlock(node);
    if (block) found.add(dom.getSidebarCard(block));
  });
  return [...found];
};

/** Cards of the "Who to follow" modules (list cells with an account suggestion). */
const sidebarUserCells = (root) => {
  const sidebar = dom.getSidebar(root);
  if (!sidebar) return [];
  const found = new Set();
  for (const cell of dom.getUserCells(sidebar)) {
    const block = dom.getSidebarBlock(cell);
    if (block) found.add(dom.getSidebarCard(block));
  }
  return [...found];
};

/** Left-navigation entries resolved by the DOM profile. */
const navItem = (kind) => (root) => [dom.getNavItem(root, kind)].filter(Boolean);

/** Left-navigation entries whose hidden target is a wrapper of the row itself. */
const navItemMapped = (kind, map) => (root) => {
  const node = dom.getNavItem(root, kind);
  return node ? [map(node)] : [];
};

/**
 * The logo and, where X wraps it, the spacer around it.
 * A wrapper is only safe while it holds the logo alone: on the modern build the
 * `<h1>` and the bare spacer both sit directly in the nav column, whose parent
 * holds every row. The spacer has no `<h1>` on the home column, so climb the
 * parents while each still holds the logo alone.
 */
function logoTarget(link) {
  const heading = link.closest('h1');
  if (heading) {
    const wrapper = heading.parentElement;
    if (wrapper && wrapper.querySelectorAll('a[href], button').length <= 1) return wrapper;
    return heading;
  }
  let target = link;
  for (let node = link.parentElement, depth = 0; node && depth < 2; node = node.parentElement, depth += 1) {
    if ((node.querySelectorAll?.('a[href], button').length ?? 0) > 1) break;
    target = node;
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

/**
 * The "Show N posts" row X puts at the top of a timeline after a refresh: a
 * cell with just one button that carries a number and no post. Thread pages
 * ("Show more replies") are left alone.
 */
function showPostsRows(root) {
  if (location.pathname.includes('/status/')) return [];
  const primary = dom.getPrimaryColumn(root);
  if (!primary || !SHOW_POSTS_BUTTON) return [];
  return dom.getPostCells(primary).filter((cell) => {
    if (cell.querySelector('article')) return false;
    const button = cell.querySelector(SHOW_POSTS_BUTTON);
    const text = (cell.textContent || '').trim();
    return Boolean(button) && text.length <= 60 && /\d/.test(text);
  });
}

const articleCell = (article) => dom.getPostCell(article) || article;

/** Result of `compute()` for this pass, shared between rules (see `Rule.inArticle`). */
const memoized = (memo, key, compute) => {
  if (!memo.has(key)) memo.set(key, compute());
  return memo.get(key);
};

/**
 * Posts quoted inside a post, as the element to hide: the card itself, or the
 * wrapper that also holds the "Quote" caption so no gap stays behind.
 */
function quotedPosts(article) {
  return dom
    .getAttachments(article)
    .filter((item) => item.kind === 'quote')
    .map((item) => {
      const wrapper = item.el.parentElement;
      return wrapper && wrapper !== article && wrapper.children.length <= 2 ? wrapper : item.el;
    });
}

/** Avatar column of the post itself (quoted posts keep theirs). */
function avatarColumns(article) {
  const avatar = dom.getAuthorAvatar(article);
  if (!avatar) return [];
  // The whole column (not just the picture), so no empty gutter stays on the left.
  const column = dom.getAvatarColumn(article);
  return [column && column !== article ? column : avatar];
}

/**
 * What makes an ancestor too big to be "just the media": it also holds the text
 * or the actions of a post (a quote's own text stops the climb inside the quote).
 */
const POST_TEXT = cssFor('tweetText');
const POST_PARTS = [POST_TEXT, '[role="group"]'].filter(Boolean).join(', ');

/**
 * Media blocks of a post (photos, videos, GIFs; also inside quotes). Each block is the largest
 * wrapper that holds nothing but media, so a photo grid goes as a whole and no empty frame
 * stays behind.
 * @returns {{ node: Element, video: boolean }[]}
 */
function mediaBlocks(article) {
  const blocks = new Map();
  for (const host of dom.getMediaHosts(article)) {
    let node = host.el;
    while (node.parentElement && node.parentElement !== article && !node.parentElement.querySelector(POST_PARTS)) {
      node = node.parentElement;
    }
    const video = host.kind === 'video' || Boolean(node.querySelector('video')) || node.matches?.('video');
    blocks.set(node, Boolean(blocks.get(node)) || video);
  }
  return [...blocks].map(([node, video]) => ({ node, video }));
}

const mediaOf = (article, memo, video) =>
  memoized(memo, 'media', () => mediaBlocks(article))
    .filter((block) => block.video === video)
    .map((block) => block.node);

/** The link preview card; its wrapper goes too (it also holds the "From example.com" caption). */
function linkCards(article) {
  return dom
    .getAttachments(article)
    .filter((item) => item.kind === 'link')
    .map((item) => {
      const card = item.el;
      const wrapper = card.parentElement;
      const single =
        wrapper && wrapper !== article && wrapper.children.length <= 2 && !wrapper.querySelector(POST_PARTS);
      return single ? wrapper : card;
    });
}

/**
 * The X Article card: cover image plus title and teaser. Found by its cover; the card is the
 * cover's parent, and a single-child link wrapper around it goes too.
 */
function articleCards(article) {
  return dom
    .getAttachments(article)
    .filter((item) => item.kind === 'article')
    .map((item) => {
      const cover = item.el;
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
  for (const header of dom.getAuthorHeaders(article)) {
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
 * The cell's own section heading, not one inside a post: the new build drops
 * `role="heading"` and may put the heading and the first recommended post into
 * the same cell.
 */
const headingOf = (cell) =>
  [...cell.querySelectorAll('h1, h2')].find((heading) => !heading.closest?.('article')) || null;

/**
 * "Discover more" on a post's page: X appends a heading cell after the replies,
 * followed by recommended posts. The heading is localized, so it is found by
 * structure; it and every cell after it are hidden.
 */
function moreFromX(root) {
  if (!location.pathname.includes('/status/')) return [];
  const primary = dom.getPrimaryColumn(root);
  if (!primary) return [];
  const cells = dom.getPostCells(primary);
  const first = cells.findIndex((cell) => cell.querySelector('article'));
  if (first < 0) return [];
  const header = cells.findIndex((cell, index) => index > first && headingOf(cell));
  return header < 0 ? [] : cells.slice(header).filter((cell) => root === document || root.contains(cell) || cell.contains(root));
}

/**
 * The "Who to follow" module X inserts into a timeline. It is rendered as list
 * cells: a cell that holds only a heading, followed by cells with account
 * suggestions (`UserCell`). The heading is localized, so the block is found by
 * structure; the variant that keeps the whole module inside one cell is matched
 * as well. A trailing "Show more" cell (it links to the suggestions page) goes
 * with it.
 */
function feedSuggestions(root) {
  const primary = dom.getPrimaryColumn(root);
  if (!primary) return [];
  const found = new Set();
  for (const cell of dom.getPostCells(primary)) {
    if (!headingOf(cell)) continue;
    if (cell.querySelector('article')) continue;
    if (cell.querySelector(USER_CELL)) {
      found.add(cell);
      continue;
    }
    const group = [cell];
    for (let next = cell.nextElementSibling; next?.matches?.(CELL); next = next.nextElementSibling) {
      if (next.querySelector('article')) break;
      if (next.querySelector(USER_CELL)) {
        group.push(next);
        continue;
      }
      // "Show more" that opens the full suggestions page.
      if (next.querySelector('a[href*="/connect_people"]')) group.push(next);
      break;
    }
    if (group.length > 1) group.forEach((node) => found.add(node));
  }
  return [...found];
}

/** Hide rule target: the tabs block (the "new posts" pill next to it stays). */
const feedTabs = (root) => dom.getFeedTabs(root).map((list) => dom.getFeedTabsBlock(list)).filter(Boolean);

/** Floating wrapper of the feed tabs: the closest `position: sticky` ancestor. */
function stickyAncestor(list) {
  const known = list.closest('[data-xp-sticky]');
  if (known) return known;
  for (let node = list.parentElement; node && !node.matches(PRIMARY_COLUMN); node = node.parentElement) {
    // `data-xp-sticky` remembers a wrapper that was already un-stuck by us.
    if (node.hasAttribute('data-xp-sticky') || getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
}

export const findStickyFeedHeaders = (root) => dom.getFeedTabs(root).map(stickyAncestor).filter(Boolean);

/** X's own translation notice above the text, of the post and of each of its quotes. */
function nativeTranslateBars(article) {
  const bars = [dom.getNativeTranslateBar(article)];
  for (const item of dom.getAttachments(article)) {
    if (item.kind === 'quote') bars.push(dom.getNativeTranslateBar(item.el));
  }
  return bars.filter(Boolean);
}

/**
 * The reply / repost / like row, plus its single-child wrappers so no gap stays
 * behind. Built from the reply *leaf*: the group fragment already carries
 * `:has()`, and nesting it inside the wrapper `:has()` is invalid CSS — the
 * browser drops that branch and the rule silently stops matching.
 */
const ARTICLE = cssFor('article');
const REPLY = cssFor('actionReply');
export const ACTION_BAR_CSS = [
  `${ARTICLE} [role="group"]:has(${REPLY})`,
  // Modern: the reply action is a direct child of the group.
  `${ARTICLE} div:has(> [role="group"]:only-child > ${REPLY})`,
  // Legacy: the group wraps its actions in one more div.
  `${ARTICLE} div:has(> [role="group"]:only-child > div > ${REPLY})`,
  `${ARTICLE} div:has(> div:only-child > [role="group"]:only-child > ${REPLY})`,
  `${ARTICLE} div:has(> div:only-child > [role="group"]:only-child > div > ${REPLY})`,
];

/** @type {Rule[]} */
export const RULES = [
  /* Posts */
  { group: 'posts', key: 'feedTabs', hint: true, find: feedTabs },
  // The modern build has no "Show N posts" marker yet: hide the switch there
  // instead of leaving a control that does nothing. The stored value is kept.
  { group: 'posts', key: 'showPosts', hint: true, generations: { modern: false }, find: showPostsRows },
  {
    group: 'posts',
    key: 'newPostsPill',
    hint: true,
    // X does not use the marker in the modern build yet; the switch and its CSS stay behind.
    generations: { modern: false },
    // The slid-in wrapper of the "N new posts" pill above the timeline.
    css: slidIn('newPostsPill', (marker) => `[role="status"] ${marker}`),
  },
  { group: 'posts', key: 'composer', hint: true, find: (root) => [dom.getInlineComposer(root)].filter(Boolean) },
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
    // The analytics link is a child of the action bar's slot; hide that slot (or the link itself).
    css: [
      `${cssFor('article')} [role="group"] > div:has(> a[href$="/analytics"])`,
      `${cssFor('article')} [role="group"] > a[href$="/analytics"]`,
    ],
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
    // X's "Source language: … Show original" line above the text, in the post and in its quotes;
    // the profile recognises the bar (glyph or localized label) and never our own chrome.
    inArticle: nativeTranslateBars,
  },
  { group: 'posts', key: 'handles', part: 'post', hint: true, inArticle: handleLabels },
  { group: 'posts', key: 'quotedPosts', part: 'post', hint: true, inArticle: quotedPosts },
  {
    group: 'posts',
    key: 'actionBar',
    part: 'post',
    hint: true,
    // The reply / repost / like row, plus up to two single-child wrappers so no gap stays behind.
    css: ACTION_BAR_CSS,
  },
  {
    group: 'posts',
    key: 'verifiedBadges',
    part: 'post',
    hint: true,
    css: cssFor('verified'),
  },
  {
    group: 'posts',
    key: 'grokButton',
    part: 'post',
    hint: true,
    // The button, or the wrapper that holds nothing else (the caret next to it stays).
    inArticle: (article) => [dom.getGrokButton(article)].filter(Boolean),
  },
  { group: 'posts', key: 'whoToFollow', hint: true, find: feedSuggestions },

  /* Sidebar (right column), top to bottom */
  {
    group: 'sidebar',
    key: 'search',
    find: (root) => {
      const sidebar = dom.getSidebar(root);
      if (!sidebar) return [];
      return [...sidebar.querySelectorAll('form[role="search"]')].map((form) => dom.getSidebarCard(form, 8));
    },
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
    find: onFragment('trend', blocksContaining),
  },
  {
    group: 'sidebar',
    key: 'whoToFollow',
    hint: true,
    find: sidebarUserCells,
  },
  {
    group: 'sidebar',
    key: 'footer',
    hint: true,
    // Links are absolute (https://x.com/tos), so match the path suffix.
    find: (root) => {
      const sidebar = dom.getSidebar(root);
      if (!sidebar) return [];
      return [...sidebar.querySelectorAll('a[href$="/tos"]')]
        .map((link) => dom.getSidebarCard(link.closest('nav') || link));
    },
  },

  /* Navigation (left menu) */
  {
    group: 'nav',
    key: 'logo',
    // The wrapper around the <h1> too, so no empty gap stays above the menu.
    find: navItemMapped('logo', logoTarget),
  },
  { group: 'nav', key: 'home', find: navItem('home') },
  { group: 'nav', key: 'explore', find: navItem('explore') },
  { group: 'nav', key: 'notifications', find: navItem('notifications') },
  { group: 'nav', key: 'chat', find: navItem('chat') },
  { group: 'nav', key: 'calls', find: navItem('calls') },
  { group: 'nav', key: 'grok', find: navItem('grok') },
  { group: 'nav', key: 'history', find: navItem('history') },
  { group: 'nav', key: 'creatorStudio', find: navItem('creatorStudio') },
  { group: 'nav', key: 'premium', find: navItem('premium') },
  { group: 'nav', key: 'followerRequests', find: navItem('followerRequests') },
  // Our own entry (nav-button.js); General → "Sidebar button" removes it for good.
  { group: 'nav', key: 'xplus', css: `${cssFor('leftNav')} [data-xp-nav]` },
  { group: 'nav', key: 'profile', find: navItem('profile') },
  { group: 'nav', key: 'more', find: navItem('more') },
  {
    group: 'nav',
    key: 'post',
    // Hide the button's wrapper too, so no empty gap stays in the menu.
    find: navItemMapped('post', (button) => button.parentElement || button),
  },
  {
    group: 'nav',
    key: 'account',
    // Account switcher at the bottom: hide its wrappers too, but never the nav.
    find: navItemMapped('account', (button) => {
      const outer = button.parentElement?.parentElement;
      if (outer && !outer.querySelector('nav')) return outer;
      return button.parentElement || button;
    }),
  },

  /* Floating panels and cards (bottom right, and the hover card anywhere) */
  { group: 'chrome', key: 'hoverCard', hint: true, css: cssFor('hoverCard') },
  {
    group: 'chrome',
    key: 'grokDrawer',
    hint: true,
    css: drawerCss('grokDrawer'),
  },
  {
    group: 'chrome',
    key: 'chatDrawer',
    hint: true,
    css: drawerCss('chatDrawer'),
  },
];

export const RULE_GROUPS = ['posts', 'sidebar', 'nav', 'chrome'];

export const ruleId = (rule) => `${rule.group}.${rule.key}`;
export const ruleLabelKey = (rule) => `interface.rule.${ruleId(rule)}`;
