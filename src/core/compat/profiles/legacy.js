/**
 * Legacy X DOM profile (`data-testid` markup).
 *
 * This is the reference implementation: it carries the selectors and
 * structural helpers that used to live in `core/constants.js` and the feature
 * modules. Features call the capabilities through `core/compat/index.js`.
 */

import {
  AD_ICON_PATH_PREFIX,
  AD_LABELS,
  NATIVE_AUTO_TRANSLATE_LABEL_RE,
  navLabelWeight,
  normalizeHandleText,
  overlayRoots,
  UI_ATTR,
} from './shared.js';

export const SEL = Object.freeze({
  article: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  quoteTweet: '[data-testid="quoteTweet"]',
  userName: '[data-testid="User-Name"]',
  userCell: '[data-testid="UserCell"]',
  quoteAvatar: '[data-testid="Tweet-User-Avatar"]',
  caret: '[data-testid="caret"]',
  actionReply: '[data-testid="reply"]',
  photo: '[data-testid="tweetPhoto"]',
  videoPlayer: '[data-testid="videoPlayer"]',
  cell: '[data-testid="cellInnerDiv"]',
  sidebar: '[data-testid="sidebarColumn"]',
  primaryColumn: '[data-testid="primaryColumn"]',
  sideNav: '[data-testid="AppTabBar"], nav[role="navigation"]',
  showMore: '[data-testid="tweet-text-show-more-link"]',
});

/**
 * Quote-card header row (avatar | User-Name). X atomic classes — adjust when
 * the web client renames them. Current: r-1awozwy; legacy: r-1habvwh.
 */
export const QUOTE_HEADER_ROW_SELECTOR =
  '.r-1awozwy.r-18u37iz.r-1wbh5a2, .r-1habvwh.r-18u37iz.r-1wbh5a2';

/**
 * Path prefix of X's machine-translation glyph (viewBox ≈ 0 0 33 32). Used on
 * the native auto-translate bar and the Grok header button, so detection must
 * stay scoped to the text column.
 */
export const NATIVE_AUTO_TRANSLATE_ICON_PATH = 'M12.745 20.54';

/** Elements that play inline video / GIFs. */
const VIDEO_HOST_SELECTOR = `${SEL.videoPlayer}, [data-testid="videoComponent"]`;

const LINK_CARD = '[data-testid="card.wrapper"]';
const POLL = '[data-testid="card.poll"], [data-testid="poll"]';
const ARTICLE_COVER = '[data-testid="article-cover-image"]';
const VERIFIED_BADGE = '[data-testid="icon-verified"]';
const SOCIAL_CONTEXT = '[data-testid="socialContext"]';

/** X Article bodies: draft-js (signed in) and the Tailwind reader (signed out). */
const ARTICLE_BODY = '[data-testid="twitterArticleRichTextView"], .x-article-body';
const ARTICLE_TITLE = '[data-testid="twitter-article-title"], h1';

/** Full-screen photo view. */
const VIEWER_LAYER = '[data-testid="swipe-to-dismiss"], [role="dialog"][aria-modal="true"]';
/** Our own gallery is a dialog too (data-xp-ui) and handles its own zoom. */
const VIEWER_IMG = `:is(${VIEWER_LAYER}):not([${UI_ATTR}]) img[src*="pbs.twimg.com/media/"]`;

/** Avatar of a post's author; the thread line runs above / below it. */
const AVATAR_SELECTOR = '[data-testid^="UserAvatar-Container"], [data-testid="Tweet-User-Avatar"]';

/** A header actions row (Grok + caret) is a few icons wide; the whole name row is not. */
const COMPACT_ACTIONS_ROW_MAX_WIDTH = 120;

/** Left-navigation rows found by a stable test id. */
const NAV_ITEM_SELECTORS = {
  logo: 'h1 a[href="/home"]',
  home: '[data-testid="AppTabBar_Home_Link"]',
  profile: '[data-testid="AppTabBar_Profile_Link"]',
  more: '[data-testid="AppTabBar_More_Menu"]',
  post: '[data-testid="SideNav_NewTweet_Button"]',
  account: '[data-testid="SideNav_AccountSwitcher_Button"]',
};

/** Left-navigation rows found by their destination. */
const NAV_ITEM_PATTERNS = {
  explore: /^\/explore/,
  notifications: /^\/notifications/,
  chat: /^\/i\/chat/,
  calls: /^\/i\/calls/,
  grok: /^\/i\/grok/,
  history: /^\/i\/history/,
  creatorStudio: /^\/i\/jf\/creators/,
  premium: /^\/i\/premium/,
  followerRequests: /^\/follower_requests/,
};

/**
 * Clone an *inactive* native row so we get normal weight + hover pill.
 * Prefer More (never a selected route); never prefer Home — often active/bold.
 * Our own injected row is never a template.
 */
function findNavTemplate(nav) {
  const more = nav.querySelector('[data-testid="AppTabBar_More_Menu"]');
  if (more?.querySelector('svg') && more.querySelector('div[dir]')) return more;

  const links = [...nav.querySelectorAll('a[role="link"], a[href]')].filter(
    (a) => !a.hasAttribute(UI_ATTR) && a.querySelector('svg') && a.querySelector('div[dir]'),
  );

  const inactive = links.find((a) => {
    if (a.getAttribute('aria-current') === 'page') return false;
    const weight = navLabelWeight(a);
    return weight == null || weight < 600;
  });
  if (inactive) return inactive;

  return (
    nav.querySelector('a[data-testid="AppTabBar_Explore_Link"]') ||
    nav.querySelector('a[data-testid="AppTabBar_Profile_Link"]') ||
    links[0] ||
    null
  );
}

function findNavInsertBefore(nav) {
  return (
    nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
    nav.querySelector('a[href="/settings"]') ||
    nav.querySelector('a[href*="/settings"]') ||
    null
  );
}

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

/** Our own translate chrome: never a signal of X's native translation. */
function isOurTranslateChrome(el) {
  return Boolean(
    el?.closest?.('[data-xp-toolbar], [data-xp-btn], [data-xp-result], .xp-header-action, .xp-btn'),
  );
}

/** X's "Source language: … Show original" bar, identified by shape and label. */
function isNativeTranslateChrome(root) {
  if (!root || root.nodeType !== 1 || isOurTranslateChrome(root)) return false;
  // Never treat another tweet body / nested quote as this post's bar.
  if (root.matches?.(SEL.tweetText)) return false;
  if (root.querySelector?.(`:scope > ${SEL.tweetText}`)) return false;
  if (root.matches?.(SEL.quoteTweet)) return false;

  for (const path of root.querySelectorAll('svg path[d]')) {
    if (isOurTranslateChrome(path)) continue;
    if ((path.getAttribute('d') || '').includes(NATIVE_AUTO_TRANSLATE_ICON_PATH)) return true;
  }

  for (const btn of root.querySelectorAll('button[aria-label]')) {
    if (isOurTranslateChrome(btn)) continue;
    const label = (btn.getAttribute('aria-label') || '').trim();
    if (NATIVE_AUTO_TRANSLATE_LABEL_RE.test(label)) return true;
  }
  return false;
}

/** First previous / next element sibling of `node` that `visit` accepts. */
function nearbySibling(node, visit) {
  for (const prop of ['previousElementSibling', 'nextElementSibling']) {
    let sibling = node[prop];
    while (sibling) {
      if (visit(sibling) === true) return sibling;
      sibling = sibling[prop];
    }
  }
  return null;
}

/** True when `el` sits inside a quote card that belongs to `article`. */
function outsideQuote(el, article) {
  if (!el) return false;
  const quote = el.closest?.(SEL.quoteTweet);
  return !quote || !article?.contains?.(quote);
}

/**
 * Quote / embed container that owns `node` inside `article`, or null. The
 * quote is a `role="link"` block nested in the article (the article's own
 * avatar uses the same `Tweet-User-Avatar` test id, so that id cannot tell
 * them apart); older markup uses `data-testid="quoteTweet"`.
 */
function quoteCardOf(node, article = api.getPostArticle(node)) {
  if (!node || !article) return null;

  const explicit = node.closest?.(SEL.quoteTweet);
  if (explicit) return explicit !== article && article.contains(explicit) ? explicit : null;

  const card = node.closest?.('[role="link"]');
  if (!card || card === article || !article.contains(card)) return null;
  // Never mistake the post's own text column for a quote wrapper.
  const ownText = api.getPostText(article);
  if (ownText && card.contains(ownText)) return null;
  return card;
}

/** Quote cards of `article`: the legacy test id plus avatar-based markup. */
function quoteCards(article) {
  const cards = new Set(article.querySelectorAll(SEL.quoteTweet));
  for (const avatar of article.querySelectorAll(SEL.quoteAvatar)) {
    const card = quoteCardOf(avatar, article);
    if (card) cards.add(card);
  }
  return [...cards];
}

/** True when `node` is a direct child row of a quote header (avatar | User-Name). */
function isQuoteHeaderRow(node) {
  return Boolean(
    node?.querySelector?.(SEL.quoteAvatar) &&
      node?.querySelector?.(SEL.userName) &&
      !node.querySelector?.(SEL.tweetText),
  );
}

/**
 * Quote embeds have no Grok / caret — append the control as a *direct child*
 * of the quote header row (avatar | User-Name).
 * @returns {{ row: Element, before: Element | null } | null}
 */
function quoteHeaderActionsSlot(quote) {
  const bySelector = [...quote.querySelectorAll(QUOTE_HEADER_ROW_SELECTOR)].find(isQuoteHeaderRow);
  if (bySelector) return { row: bySelector, before: null };

  // Structural fallback when X renames atomic row classes.
  const userName = quote.querySelector(SEL.userName);
  if (!userName) return null;
  let node = userName.parentElement;
  while (node && node !== quote) {
    if (isQuoteHeaderRow(node)) {
      const style = getComputedStyle(node);
      const isRow =
        (style.display === 'flex' || style.display === 'inline-flex') &&
        String(style.flexDirection || 'row').startsWith('row');
      if (isRow) return { row: node, before: null };
    }
    node = node.parentElement;
  }
  return null;
}


const api = {
  getArticles(root) {
    return [...root.querySelectorAll(SEL.article)];
  },

  getTextRoots(root = document) {
    const nodes = [];
    root.querySelectorAll(SEL.tweetText).forEach((el) => {
      if (!el.closest?.(SEL.article)) return;
      const nestedParent = el.parentElement?.closest?.(SEL.tweetText);
      if (nestedParent && nestedParent !== el) return;
      nodes.push(el);
    });
    return nodes;
  },

  getPostArticle(node) {
    return node?.closest?.(SEL.article) || null;
  },

  getPostCell(article) {
    return article?.closest?.(SEL.cell) || article || null;
  },

  getPostCells(root) {
    return [...root.querySelectorAll(SEL.cell)];
  },

  getPostText(article) {
    if (!article) return null;
    for (const el of article.querySelectorAll(SEL.tweetText)) {
      if (outsideQuote(el, article)) return el;
    }
    return null;
  },

  isOwnText(node, article) {
    return Boolean(node?.closest?.(SEL.article) === article && !node.closest?.(SEL.quoteTweet));
  },

  getAuthorHeader(article) {
    if (!article) return null;
    for (const header of article.querySelectorAll(SEL.userName)) {
      if (outsideQuote(header, article)) return header;
    }
    return null;
  },

  /** Every author block of the post, quoted posts included. */
  getAuthorHeaders(article) {
    return article ? [...article.querySelectorAll(SEL.userName)] : [];
  },

  getAuthorName(article) {
    const header = api.getAuthorHeader(article);
    if (!header) return '';

    for (const link of header.querySelectorAll('a[href]')) {
      const text = link.textContent?.trim() || '';
      if (text && !text.startsWith('@')) return text;
    }

    for (const node of header.querySelectorAll('div[dir="ltr"], span')) {
      const text = node.textContent?.trim() || '';
      if (text && !text.startsWith('@')) return text;
    }

    return (header.textContent || '').trim();
  },

  getAuthorHandle(article) {
    const header = api.getAuthorHeader(article);
    if (!header) return '';

    for (const node of header.querySelectorAll('span, div, a[href]')) {
      const text = node.textContent?.trim() || '';
      if (text.startsWith('@') && text.length > 1) return normalizeHandleText(text);
    }

    for (const link of header.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href') || '';
      if (/\/status\//i.test(href)) continue;
      const match = href.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
      if (match) return match[1].toLowerCase();
    }

    return '';
  },

  getAuthorAvatar(article) {
    if (!article) return null;
    const candidates = article.querySelectorAll(AVATAR_SELECTOR);
    for (const el of candidates) {
      if (outsideQuote(el, article)) return el;
    }
    return null;
  },

  getTimeLink(article) {
    if (!article) return null;
    for (const time of article.querySelectorAll('a[href*="/status/"] time')) {
      if (outsideQuote(time, article)) return time.closest('a');
    }
    for (const link of article.querySelectorAll('a[href*="/status/"]')) {
      if (outsideQuote(link, article)) return link;
    }
    return null;
  },

  getHeaderActionsSlot(postEl) {
    if (!postEl) return null;
    const quote = api.getQuoteCard(postEl);
    if (quote) return quoteHeaderActionsSlot(quote);

    const article = api.getPostArticle(postEl);
    if (!article) return null;

    // Only this tweet's own chrome counts: not quote cards, and not posts nested
    // inside it (an X Article embeds whole posts, each with its own Grok / ⋮).
    const isOwn = (node) => outsideQuote(node, article) && node.closest('article') === article;

    let grokBtn = null;
    for (const btn of article.querySelectorAll('button[aria-label]')) {
      if (!isOwn(btn)) continue;
      if (/grok/i.test(btn.getAttribute('aria-label') || '')) {
        grokBtn = btn;
        break;
      }
    }

    if (grokBtn?.parentElement?.parentElement) {
      const wrap = grokBtn.parentElement;
      const row = wrap.parentElement;
      if (row && article.contains(row)) return { row, before: wrap };
    }

    const caret = [...article.querySelectorAll(SEL.caret)].find(isOwn);
    if (!caret) return null;

    // Walk up from the caret through flex rows. The Grok button is labelled in the
    // UI language ("Составить сводку", …), so it cannot be found by name: prefer the
    // compact row that holds *both* actions (Grok + ⋮) and insert before the first.
    let first = null;
    let compact = null;
    let node = caret;
    while (node.parentElement && node.parentElement !== article) {
      const parent = node.parentElement;
      const style = getComputedStyle(parent);
      const isRow =
        (style.display === 'flex' || style.display === 'inline-flex') &&
        String(style.flexDirection || '').startsWith('row');
      if (isRow && parent.children.length >= 1 && parent.children.length <= 4) {
        const before = [...parent.children].find((child) => child.contains(caret));
        if (before) {
          first ??= { row: parent, before };
          if (
            !compact &&
            parent.children.length >= 2 &&
            parent.getBoundingClientRect().width <= COMPACT_ACTIONS_ROW_MAX_WIDTH
          ) {
            compact = { row: parent, before: parent.firstElementChild };
          }
        }
      }
      node = parent;
    }
    return compact || first;
  },

  /**
   * The post's Grok control, or the single-child wrapper around it so no gap
   * stays behind (the caret next to it keeps its own wrapper).
   */
  getGrokButton(article) {
    if (!article) return null;
    for (const button of article.querySelectorAll('button[aria-label]')) {
      const label = (button.getAttribute('aria-label') || '').trim().toLowerCase();
      if (!label.includes('grok')) continue;
      if (!outsideQuote(button, article)) continue;
      const parent = button.parentElement;
      return parent && parent !== article && parent.children.length === 1 ? parent : button;
    }
    return null;
  },

  getActionGroup(article) {
    if (!article) return null;
    for (const reply of article.querySelectorAll(SEL.actionReply)) {
      if (!outsideQuote(reply, article)) continue;
      return reply.closest('[role="group"]') || null;
    }
    return null;
  },

  getQuoteCard(node, article) {
    return quoteCardOf(node, article);
  },

  /**
   * Elements that carry media in an article. A video wrapped in a photo host
   * (GIFs) is reported once, as a video.
   * @returns {{ el: Element, kind: 'photo' | 'video', owner: 'main' | 'quote' }[]}
   */
  getMediaHosts(article) {
    if (!article) return [];
    const hosts = [];
    const seen = new Set();
    const push = (el, kind) => {
      if (seen.has(el)) return;
      seen.add(el);
      hosts.push({ el, kind, owner: outsideQuote(el, article) ? 'main' : 'quote' });
    };

    article.querySelectorAll(VIDEO_HOST_SELECTOR).forEach((el) => push(el, 'video'));
    article.querySelectorAll(SEL.photo).forEach((el) => {
      // A video wrapped in tweetPhoto (GIFs) is already covered above.
      if (el.querySelector('video') || el.closest(VIDEO_HOST_SELECTOR)) return;
      if (el.querySelector('img')) push(el, 'photo');
    });
    return hosts;
  },

  /**
   * Cards embedded in an article: the quote itself, link previews, polls and
   * X Article covers.
   * @returns {{ kind: 'quote' | 'link' | 'poll' | 'article', el: Element, owner: 'main' | 'quote' }[]}
   */
  getAttachments(article) {
    if (!article) return [];
    const items = [];
    const seen = new Set();
    const push = (kind, el, owner) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      items.push({ kind, el, owner });
    };

    const quotes = quoteCards(article);
    for (const card of quotes) push('quote', card, 'main');
    const inQuote = (el) => quotes.some((card) => card !== el && card.contains(el));

    for (const [kind, selector] of [
      ['link', LINK_CARD],
      ['poll', POLL],
      ['article', ARTICLE_COVER],
    ]) {
      for (const el of article.querySelectorAll(selector)) {
        push(kind, el, inQuote(el) ? 'quote' : 'main');
      }
    }
    return items;
  },

  getVerifiedBadge(article) {
    if (!article) return null;
    for (const badge of article.querySelectorAll(VERIFIED_BADGE)) {
      if (outsideQuote(badge, article)) return badge;
    }
    return null;
  },

  getSocialContext(article) {
    const cell = article?.closest?.(SEL.cell);
    return cell?.querySelector?.(SOCIAL_CONTEXT) || null;
  },

  getNav(root) {
    return (
      root.querySelector('[data-testid="AppTabBar"]') ||
      root.querySelector('header[role="banner"] nav[role="navigation"]') ||
      null
    );
  },

  getNavItem(root, kind) {
    const scope = root.querySelector?.('header[role="banner"]') || root;
    const selector = NAV_ITEM_SELECTORS[kind];
    if (selector) return scope.querySelector(selector) || null;

    const pattern = NAV_ITEM_PATTERNS[kind];
    if (!pattern) return null;
    for (const link of scope.querySelectorAll('a[href]')) {
      if (pattern.test(link.getAttribute('href') || '')) return link;
    }
    return null;
  },

  getNavTemplate(nav) {
    const template = findNavTemplate(nav);
    if (!template) return null;
    return { template, before: findNavInsertBefore(nav) };
  },

  getSidebar(root) {
    return root.querySelector(SEL.sidebar);
  },

  /**
   * Smallest sidebar block that contains `node`: X renders each sidebar module
   * (Who to follow, Trends, Premium card, …) as an `aside` / `section`.
   */
  getSidebarBlock(node) {
    if (!node) return null;
    const sidebar = node.closest?.(SEL.sidebar);
    if (!sidebar) return null;
    const block = node.closest('aside, section, [role="complementary"], [role="region"]');
    return block && sidebar.contains(block) ? block : null;
  },

  /**
   * The bordered "card" X draws around a sidebar module. Hiding only the inner
   * `aside` / `section` would leave an empty frame, so climb through wrappers
   * that hold nothing else (at most `limit` levels, never past the sidebar).
   */
  getSidebarCard(node, limit = 3) {
    if (!node) return null;
    let card = node;
    for (let i = 0; i < limit; i += 1) {
      const parent = card.parentElement;
      if (!parent || parent.children.length !== 1 || parent.matches(SEL.sidebar)) break;
      if (parent.querySelector('form[role="search"]') && !card.querySelector('form[role="search"]')) break;
      card = parent;
    }
    return card;
  },

  getUserCells(root) {
    return [...root.querySelectorAll(SEL.userCell)];
  },

  getMenus(root) {
    return [...root.querySelectorAll('[role="menu"]')];
  },

  /** The ⋮ (caret) button of `article` itself, not of a post nested inside it. */
  getPostMenuTrigger(article) {
    if (!article) return null;
    for (const caret of article.querySelectorAll(SEL.caret)) {
      if (caret.closest(SEL.article) === article) return caret;
    }
    return null;
  },

  isMenuOpen(trigger) {
    if (!trigger?.getAttribute) return false;
    // X marks the open caret with `aria-expanded`; some builds only flip `aria-pressed`.
    return (
      trigger.getAttribute('aria-expanded') === 'true' || trigger.getAttribute('aria-pressed') === 'true'
    );
  },

  getMenuItemHost(menu) {
    const first = menu?.querySelector?.('[role="menuitem"], [data-testid]');
    return first?.parentElement || null;
  },

  getComposer(root) {
    const inline = root.querySelector('[data-testid="tweetTextarea_0"]');
    if (inline) return inline;
    for (const node of root.querySelectorAll('[contenteditable="true"], [role="textbox"]')) {
      if (!node.closest('[role="dialog"]')) return node;
    }
    return null;
  },

  getInlineComposer(root) {
    return inlineComposers(root)[0] || null;
  },

  getFeedTabs(root) {
    return feedTabLists(root);
  },

  getFeedTabsBlock(list) {
    return feedTabsBlock(list);
  },

  getArticleBody(root) {
    return root.querySelector(ARTICLE_BODY);
  },

  /** The article's title element (outside the body, inside a nearby ancestor). */
  getArticleTitle(body) {
    if (!body) return null;
    let scope = body;
    for (let depth = 0; depth < 6; depth += 1) {
      scope = scope.parentElement;
      if (!scope) return null;
      for (const candidate of scope.querySelectorAll(ARTICLE_TITLE)) {
        if (!body.contains(candidate) && !candidate.closest(`article, [${UI_ATTR}]`)) return candidate;
      }
    }
    return null;
  },

  getViewerLayer(root) {
    return root.querySelector(VIEWER_LAYER);
  },

  getViewerImages(root) {
    return [...root.querySelectorAll(VIEWER_IMG)];
  },

  /**
   * The photo stage: the nearest ancestor with the dimming inline
   * `background-color` (X's class names are unstable); falls back to the
   * innermost ancestor that fills the viewport.
   */
  getViewerStage(img) {
    if (!img) return null;
    const layer = img.closest?.(VIEWER_LAYER) || null;
    // X dims the page with an inline `background-color` on the stage element.
    for (let node = img.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.style?.backgroundColor) return node;
    }
    for (let node = img.parentElement; node && node !== layer; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) return node;
    }
    return layer;
  },

  getPrimaryColumn(root) {
    return root.querySelector(SEL.primaryColumn);
  },

  getSidebarColumn(root) {
    return root.querySelector(SEL.sidebar);
  },

  getLeftNav(root) {
    return root.querySelector('header[role="banner"]');
  },

  getOverlayRoots(root) {
    return overlayRoots(root);
  },

  /**
   * The avatar column of the post itself: the avatar's ancestor just below the
   * place where the post's text column joins it. Quoted posts keep theirs.
   */
  getAvatarColumn(article) {
    if (!article) return null;
    const avatar = api.getAuthorAvatar(article);
    if (!avatar) return null;
    let column = avatar;
    while (column.parentElement && column.parentElement !== article && !column.parentElement.querySelector(SEL.userName)) {
      column = column.parentElement;
    }
    return column;
  },

  /**
   * Bars that may be a thread line: the empty `div`s of the avatar column.
   * Geometry filtering (thin, on the avatar axis) stays with the caller.
   */
  getThreadLineCandidates(article) {
    const column = api.getAvatarColumn(article);
    if (!column) return [];
    return [...column.querySelectorAll('div')];
  },

  /**
   * X's own machine-translation bar for `article` (the post itself or a quote
   * card): the sibling of its text that carries the translate glyph or the
   * localized "Show original" label.
   */
  getNativeTranslateBar(article) {
    if (!article) return null;
    const text = article.matches?.(SEL.tweetText) ? article : article.querySelector?.(SEL.tweetText);
    if (!text) return null;
    const inQuote = api.getPostArticle(article) !== article;

    let node = text;
    for (let depth = 0; depth < 6 && node && article.contains?.(node); depth += 1) {
      const hit = nearbySibling(node, (sibling) => {
        if (sibling === text || sibling.contains?.(text)) return false;
        if (sibling.matches?.(SEL.tweetText)) return false;
        if (!inQuote && sibling.matches?.(SEL.quoteTweet)) return false;
        // Stay in the text column — skip header chrome (Grok uses the same glyph).
        if (sibling.querySelector?.(`${SEL.userName}, ${SEL.caret}`)) return false;
        return isNativeTranslateChrome(sibling);
      });
      if (hit) return hit;
      if (node === article) break;
      node = node.parentElement;
    }
    return null;
  },

  hasNativeAutoTranslate(article) {
    return Boolean(api.getNativeTranslateBar(article));
  },

  isPromotedArticle(article) {
    if (!article) return false;
    if (article.querySelector(`svg path[d^="${AD_ICON_PATH_PREFIX}"]`)) return true;
    // Cheapest checks first: a leaf span with a short text, and only then the label set and
    // the (costly) `closest`. The label sits near the top of the post, so a
    // bounded walk is enough even for very long posts.
    let examined = 0;
    for (const span of article.querySelectorAll('span')) {
      if (examined >= 250) break;
      examined += 1;
      if (span.firstElementChild || span.textContent.length > 20) continue;
      if (AD_LABELS.has(span.textContent.trim().toLowerCase()) && !span.closest(SEL.tweetText)) return true;
    }
    return false;
  },
};


export default {
  id: 'legacy',

  detect(root) {
    return Boolean(
      root.querySelector('article[data-testid="tweet"]') ||
        root.querySelector('[data-testid="tweetText"]') ||
        root.querySelector('[data-testid="primaryColumn"]'),
    );
  },

  api,
  css: {
    article: 'article[data-testid="tweet"]',
    cell: '[data-testid="cellInnerDiv"]',
    // The legacy article inside a timeline cell *is* the rounded block around the post.
    postSurface: '[data-testid="cellInnerDiv"] article[data-testid="tweet"]',
    // The gap is padding around the article, inside the cell, so X keeps measuring cells.
    postGapPad: '[data-testid="cellInnerDiv"] div:has(> article[data-testid="tweet"])',
    tweetText: '[data-testid="tweetText"]',
    actionReply: '[data-testid="reply"]',
    actionGroup: '[role="group"]:has(> div > [data-testid="reply"])',
    primaryColumn: '[data-testid="primaryColumn"]',
    sidebarColumn: '[data-testid="sidebarColumn"]',
    leftNav: 'header[role="banner"]',
    avatar: '[data-testid^="UserAvatar-Container"]',
    userCell: '[data-testid="UserCell"]',
    verified: '[data-testid="icon-verified"]',
    // Empty atomic-class strip X draws above the feed, which reads as a top border.
    feedEdgeStrip: 'div.r-109y4c4.r-gu4em3',
    // X caps inner feed blocks with the atomic class `max-width: 600px`.
    contentCap: '.r-1ye8kvj',
    // The row that holds the three columns, inside <body>.
    mainRow: 'main[role="main"]',
    // The list of menu entries inside the left column.
    leftNavList: 'nav[role="navigation"]',
    // One trend in the sidebar trends module.
    trend: '[data-testid="trend"]',
    // The "N new posts" pill above the timeline.
    newPostsPill: '[data-testid="pillLabel"]',
    // The button of the "Show N posts" row.
    showPostsButton: '[data-keep-composer-open] > button',
    // Floating panels in the bottom-right corner (Grok, chat) and their roots.
    grokDrawer: '[data-testid="GrokDrawer"]',
    chatDrawer: '[data-testid="chat-drawer-root"]',
  },
};
