/**
 * Modern X DOM profile (2026 Tailwind + `xds` markup).
 *
 * Posts are bare `<article>`s in `li[data-index]` cells, actions carry
 * `data-engagement-action`, the text root is `[dir="auto"].whitespace-pre-wrap`
 * and the author avatar is `[data-post-avatar]`. The legacy `data-testid`s are
 * gone, so every lookup stays inside the passed article and its own quote
 * frame boundary.
 *
 * See docs/superpowers/specs/2026-11-26-dom-compatibility-design.md §7.2.
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

const QUOTE_FRAME = '[data-slot="embedded-tweet-frame"]';
const POST_TEXT = '[dir="auto"].whitespace-pre-wrap';
const MEDIA_HOST = '[data-engagement-action="media"]';
const LINK_CARD = '[data-testid="card.wrapper"]';
const POLL = '[data-testid="card.poll"], [role="radiogroup"]';
const ARTICLE_COVER = '[data-testid="article-cover-image"], a[href*="/i/article/"] img';
const VERIFIED = 'svg[data-icon*="verified"], [data-testid="icon-verified"]';
const MENU = '[role="menu"][data-slot="xds-menu-content"]';
const SIDEBAR_BLOCK = 'section, div[role="complementary"], aside, [role="region"], nav';
const ARTICLE_BODY = '[data-testid="twitterArticleRichTextView"], .x-article-body';
const ARTICLE_TITLE = '[data-testid="twitter-article-title"], h1';
const VIEWER_LAYER = '[role="dialog"][data-slot="xds-modal-surface"], [role="dialog"][aria-modal="true"]';

/** Left-navigation hrefs of the modern nav (one path per row). */
const NAV_HREFS = {
  home: '/home',
  explore: '/explore',
  notifications: '/notifications',
  chat: '/i/chat',
  calls: '/i/calls',
  grok: '/i/grok',
  history: '/i/history',
  creatorStudio: '/i/jf/creators',
  premium: '/i/premium',
  followerRequests: '/follower_requests',
  post: '/compose/post',
};

/** Whether `actual` is the base href or a sub-path of it (`/i/premium` ← `/i/premium_sign_up`). */
function matchesNavHref(actual, base) {
  const path = String(actual || '').split('?')[0];
  return path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}_`);
}

/** Nearest `position: sticky` ancestor below `stop` (the feed tabs float there). */
function stickyAncestor(list, stop) {
  for (let node = list.parentElement; node && node !== stop; node = node.parentElement) {
    if (node.hasAttribute?.('data-xp-sticky') || getComputedStyle(node).position === 'sticky') return node;
  }
  return null;
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

/** X's "Source language: … Show original" bar, identified by shape and label. */
function isNativeTranslateChrome(root) {
  if (!root || root.nodeType !== 1 || root.closest?.(`[${UI_ATTR}]`)) return false;
  if (root.matches?.(POST_TEXT)) return false;
  if (root.querySelector?.(`:scope > ${POST_TEXT}`)) return false;

  for (const button of root.querySelectorAll('button[aria-label]')) {
    if (button.closest?.(`[${UI_ATTR}]`)) continue;
    if (NATIVE_AUTO_TRANSLATE_LABEL_RE.test((button.getAttribute('aria-label') || '').trim())) return true;
  }
  const label = root.textContent?.trim() || '';
  return label.length > 0 && label.length <= 60 && NATIVE_AUTO_TRANSLATE_LABEL_RE.test(label);
}

/**
 * Quote embeds have no Grok / caret row of their own: append the control to the
 * embedded post's author header.
 * @returns {{ row: Element, before: null } | null}
 */
function quoteHeaderActionsSlot(quote) {
  const article = quote.querySelector?.('article') || quote;
  // The author row: the line that holds the display name (what legacy's quote row is).
  const row =
    article.querySelector?.('div[dir="auto"]')?.parentElement ||
    article.querySelector?.('header') ||
    api.getAuthorHeader(article);
  return row ? { row, before: null } : null;
}

const api = {
  getArticles(root) {
    return [...root.querySelectorAll('article')].filter(
      (article) =>
        !article.matches?.('[data-testid="tweet"]') &&
        !article.closest?.(QUOTE_FRAME) &&
        !article.parentElement?.closest?.('article'),
    );
  },

  getTextRoots(root = document) {
    return [...root.querySelectorAll(`article ${POST_TEXT}`)];
  },

  getPostArticle(node) {
    return node?.closest?.('article') || null;
  },

  getPostCell(article) {
    return (
      article?.closest?.('li[data-index]') ||
      article?.closest?.('[data-index]') ||
      article?.closest?.('li') ||
      article ||
      null
    );
  },

  getPostCells(root) {
    return [...root.querySelectorAll('li[data-index]')];
  },

  getPostText(article) {
    if (!article) return null;
    return [...article.querySelectorAll(POST_TEXT)].find((node) => node.closest?.('article') === article) || null;
  },

  isOwnText(node, article) {
    return Boolean(node?.closest?.('article') === article);
  },

  getAuthorAvatar(article) {
    if (!article) return null;
    for (const avatar of article.querySelectorAll('[data-post-avatar]')) {
      if (avatar.closest?.('article') === article) return avatar;
    }
    const img = article.querySelector('header img[alt^="@"]');
    return img?.parentElement || null;
  },

  /**
   * Smallest ancestor of the avatar that carries the author name; one that also
   * holds a post link wins, but promoted posts sometimes have no time link.
   */
  getAuthorHeader(article) {
    const avatar = api.getAuthorAvatar(article);
    if (!avatar) return null;
    let fallback = null;
    for (let node = avatar.parentElement; node; node = node.parentElement) {
      if (node.querySelector?.('div[dir="auto"]')) {
        if (node.querySelector?.('a[href*="/status/"]')) return node;
        fallback ??= node;
      }
      if (node === article) break;
    }
    return fallback;
  },

  /** Every author block of the post, quoted posts included. */
  getAuthorHeaders(article) {
    if (!article) return [];
    const headers = [];
    const push = (header) => {
      if (header && !headers.includes(header)) headers.push(header);
    };
    push(api.getAuthorHeader(article));
    for (const nested of article.querySelectorAll('article')) push(api.getAuthorHeader(nested));
    return headers;
  },

  getAuthorName(article) {
    const header = api.getAuthorHeader(article);
    if (!header) return '';
    const name = header.querySelector('div[dir="auto"]')?.textContent?.trim();
    if (name && !name.startsWith('@')) return name;
    for (const link of header.querySelectorAll('a[href]')) {
      const text = link.textContent?.trim() || '';
      if (text && !text.startsWith('@')) return text;
    }
    return '';
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

  getTimeLink(article) {
    const header = api.getAuthorHeader(article);
    if (!header) return null;
    return header.querySelector('a[href*="/status/"]') || null;
  },

  getHeaderActionsSlot(postEl) {
    if (!postEl) return null;
    const quote = api.getQuoteCard(postEl);
    if (quote) return quoteHeaderActionsSlot(quote);

    const article = api.getPostArticle(postEl);
    if (!article) return null;
    const caret = api.getAuthorHeader(article)?.querySelector('button[aria-haspopup="menu"]');
    if (!caret) return null;
    const row = caret.parentElement;
    if (!row) return null;
    const grok = [...row.querySelectorAll('button')].find((button) =>
      button.querySelector('svg[data-icon="icon-logo-grok"]'),
    );
    // Insert before the Grok wrapper when X wraps it, before the button itself otherwise.
    const before = grok ? (grok.parentElement && grok.parentElement !== row ? grok.parentElement : grok) : caret;
    return { row, before };
  },

  /**
   * The post's Grok control, or the single-child wrapper around it so no gap
   * stays behind (the caret next to it keeps its own slot).
   */
  getGrokButton(article) {
    if (!article) return null;
    for (const button of article.querySelectorAll('button')) {
      if (button.closest?.('article') !== article) continue;
      if (!button.querySelector('svg[data-icon="icon-logo-grok"]')) continue;
      const parent = button.parentElement;
      return parent && parent !== article && parent.children.length === 1 ? parent : button;
    }
    return null;
  },

  getActionGroup(article) {
    if (!article) return null;
    return (
      [...article.querySelectorAll('[role="group"]')].find(
        (group) => group.closest?.('article') === article && group.querySelector('[data-engagement-action="reply"]'),
      ) || null
    );
  },

  getQuoteCard(node, article) {
    if (!node) return null;
    const frame = node.closest?.(QUOTE_FRAME);
    if (frame) {
      // A quote frame nests a whole article: the owner is the article *around* the frame.
      const owner = article || frame.parentElement?.closest?.('article') || null;
      return owner?.contains(frame) ? frame : null;
    }

    const owner = article || api.getPostArticle(node);
    if (!owner) return null;
    const card = node.closest?.('[role="link"][data-href]');
    if (!card || card === owner || !owner.contains(card)) return null;
    // Never mistake the post's own text column for a quote wrapper.
    const ownText = api.getPostText(owner);
    if (ownText && card.contains(ownText)) return null;
    return card;
  },

  /**
   * Elements that carry media in an article. A video inside a media block (GIFs)
   * is reported once, as that block.
   * @returns {{ el: Element, kind: 'photo' | 'video', owner: 'main' | 'quote' }[]}
   */
  getMediaHosts(article) {
    if (!article) return [];
    const hosts = [];
    const seen = new Set();
    const push = (el, kind) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      hosts.push({ el, kind, owner: el.closest?.('article') === article ? 'main' : 'quote' });
    };

    for (const el of article.querySelectorAll(MEDIA_HOST)) {
      push(el, el.matches?.('video') || el.querySelector('video') ? 'video' : 'photo');
    }
    for (const video of article.querySelectorAll('video')) {
      if (hosts.some((host) => host.el.contains(video))) continue;
      push(video, 'video');
    }
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

    const quotes = [...article.querySelectorAll(QUOTE_FRAME)].filter(
      (frame) => frame.closest?.('article') === article,
    );
    for (const quote of quotes) push('quote', quote, 'main');
    const inQuote = (el) => quotes.some((quote) => quote !== el && quote.contains(el));

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
    for (const badge of article.querySelectorAll(VERIFIED)) {
      if (badge.closest?.('article') === article) return badge;
    }
    return null;
  },

  getSocialContext(article) {
    if (!article) return null;
    const cell = article.closest?.('li[data-index]');
    return cell?.querySelector?.('[data-testid="socialContext"]') || article.querySelector('[data-testid="socialContext"]') || null;
  },

  isPromotedArticle(article) {
    if (!article) return false;
    if (article.querySelector(`svg path[d^="${AD_ICON_PATH_PREFIX}"]`)) return true;
    let examined = 0;
    for (const span of article.querySelectorAll('span')) {
      if (examined >= 250) break;
      examined += 1;
      if (span.firstElementChild || span.textContent.length > 20) continue;
      if (AD_LABELS.has(span.textContent.trim().toLowerCase()) && !span.closest(POST_TEXT)) return true;
    }
    return false;
  },

  getMenus(root) {
    const menus = [...root.querySelectorAll(MENU)];
    return menus.length ? menus : [...root.querySelectorAll('[role="menu"]')];
  },

  /** The ⋮ (menu) button of `article` itself, not of a post nested inside it. */
  getPostMenuTrigger(article) {
    if (!article) return null;
    for (const trigger of article.querySelectorAll('button[aria-haspopup="menu"]')) {
      if (trigger.closest?.('article') === article) return trigger;
    }
    return null;
  },

  isMenuOpen(trigger) {
    if (!trigger?.getAttribute) return false;
    return trigger.getAttribute('aria-expanded') === 'true' || trigger.getAttribute('aria-pressed') === 'true';
  },

  getMenuItemHost(menu) {
    const first =
      menu?.querySelector?.('[role="menuitem"][data-slot="xds-menu-item"]') || menu?.querySelector?.('[role="menuitem"]');
    return first?.parentElement || null;
  },

  getNav(root) {
    for (const nav of root.querySelectorAll('nav')) {
      if (nav.querySelector?.('a[href="/home"]')) return nav;
    }
    return null;
  },

  getNavItem(root, kind) {
    const nav = api.getNav(root) || root;
    if (kind === 'logo') {
      return (
        [...nav.querySelectorAll('a[href="/home"]')].find((link) =>
          link.querySelector('svg[data-icon="icon-logo-x"]'),
        ) || null
      );
    }
    if (kind === 'profile') {
      return (
        [...nav.querySelectorAll('a[href]')].find((link) => link.querySelector('img[src*="profile_images"]')) || null
      );
    }
    if (kind === 'account') {
      return (
        [...nav.querySelectorAll('button')].find((button) => button.querySelector('img[src*="profile_images"]')) ||
        null
      );
    }
    if (kind === 'more') {
      return (
        [...nav.querySelectorAll('button')].find((button) =>
          button.querySelector('svg[data-icon="icon-more-dots-hor-circle"]'),
        ) || null
      );
    }
    const href = NAV_HREFS[kind];
    if (!href) return null;
    const links = [...nav.querySelectorAll('a[href]')].filter((link) => matchesNavHref(link.getAttribute('href'), href));
    // `/home` is both the logo and the Home row: the row carries a text label.
    if (kind === 'home') return links.find((link) => link.querySelector('span')) || links[0] || null;
    if (links[0]) return links[0];
    // The Post button is not one of the nav rows on the modern build.
    if (kind === 'post' && nav !== root) {
      return [...root.querySelectorAll('a[href]')].find((link) => matchesNavHref(link.getAttribute('href'), href)) || null;
    }
    return null;
  },

  getNavTemplate(nav) {
    if (!nav) return null;
    const links = [...nav.querySelectorAll('a[href]')].filter(
      (link) => !link.hasAttribute('data-xp-ui') && link.querySelector('svg') && link.querySelector('span'),
    );
    const template =
      links.find((link) => {
        if (link.getAttribute('aria-current') === 'page') return false;
        const weight = navLabelWeight(link);
        return weight == null || weight < 600;
      }) ||
      links[0] ||
      null;
    if (!template) return null;
    // Before Settings when the menu has that row; otherwise before the trailing "More"
    // button, where X keeps the entries that open a sheet.
    const before =
      [...nav.querySelectorAll('a[href]')].find((link) => (link.getAttribute('href') || '').includes('/settings')) ||
      [...nav.querySelectorAll('button')].find((button) =>
        button.querySelector('svg[data-icon="icon-more-dots-hor-circle"]'),
      ) ||
      null;
    return { template, before: before || null };
  },

  getSidebar(root) {
    for (const aside of root.querySelectorAll('aside')) {
      if (aside.querySelector('[data-who-to-follow], section, nav[aria-label]')) return aside;
    }
    return null;
  },

  getSidebarBlock(node) {
    if (!node) return null;
    const sidebar = node.closest?.('aside');
    if (!sidebar) return null;
    const block = node.closest(SIDEBAR_BLOCK);
    return block && sidebar.contains(block) ? block : null;
  },

  getSidebarCard(node, limit = 3) {
    if (!node) return null;
    const sidebar = node.closest?.('aside') || null;
    let card = node;
    for (let i = 0; i < limit; i += 1) {
      const parent = card.parentElement;
      if (!parent || parent === sidebar || parent.children.length !== 1) break;
      if (!sidebar?.contains(parent)) break;
      if (parent.querySelector('form[role="search"]') && !card.querySelector('form[role="search"]')) break;
      card = parent;
    }
    return card;
  },

  getUserCells(root) {
    return [...root.querySelectorAll('[data-who-to-follow]')];
  },

  getComposer(root) {
    return root.querySelector('main textarea[aria-label], main [role="textbox"]') || null;
  },

  getInlineComposer(root) {
    const field = api.getComposer(root);
    if (!field) return null;
    let node = field;
    for (let i = 0; i < 8 && node.parentElement; i += 1) {
      node = node.parentElement;
      if (node.closest?.('article, [role="dialog"]')) break;
      if (node.querySelector?.('[role="progressbar"]')) return node;
    }
    return null;
  },

  getFeedTabs(root) {
    return [...root.querySelectorAll('main [role="tablist"]')];
  },

  getFeedTabsBlock(list) {
    if (!list) return null;
    const sticky = stickyAncestor(list, list.closest('main'));
    if (sticky) return sticky;
    let block = list;
    for (let i = 0; i < 4; i += 1) {
      const parent = block.parentElement;
      if (!parent || parent.children.length !== 1) break;
      if (parent.querySelector('article') || parent.matches('li[data-index]')) break;
      block = parent;
    }
    return block;
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
    const layer = api.getViewerLayer(root);
    if (!layer) return [];
    return [...layer.querySelectorAll('img[src*="pbs.twimg.com/media/"]')].filter(
      (img) => !img.closest(`[${UI_ATTR}]`),
    );
  },

  /** The photo stage: the nearest `object-contain` ancestor, else the viewport-sized one. */
  getViewerStage(img) {
    if (!img) return null;
    const layer = img.closest?.(VIEWER_LAYER) || null;
    for (let node = img.parentElement; node && node !== layer; node = node.parentElement) {
      if (node.classList?.contains('object-contain') || getComputedStyle(node).objectFit === 'contain') return node;
    }
    for (let node = img.parentElement; node && node !== layer; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) return node;
    }
    return layer;
  },

  getPrimaryColumn(root) {
    return root.querySelector('main');
  },

  getSidebarColumn(root) {
    return api.getSidebar(root);
  },

  getLeftNav(root) {
    return api.getNav(root);
  },

  getOverlayRoots(root) {
    return overlayRoots(root);
  },

  /** The avatar column of the post itself (`self-stretch` row next to the text). */
  getAvatarColumn(article) {
    if (!article) return null;
    const avatar = api.getAuthorAvatar(article);
    if (!avatar) return null;
    let node = avatar;
    while (node.parentElement && node.parentElement !== article) {
      if (node.classList?.contains('self-stretch')) return node;
      node = node.parentElement;
    }
    return avatar.parentElement || avatar;
  },

  /**
   * Bars that may be a thread line: the empty spans / divs of the avatar column.
   * Geometry filtering (thin, on the avatar axis) stays with the caller.
   */
  getThreadLineCandidates(article) {
    const column = api.getAvatarColumn(article);
    if (!column) return [];
    return [...column.querySelectorAll('span, div')];
  },

  /**
   * X's own machine-translation bar for `article` (the post itself or a quote
   * card): the sibling of its text that carries a button labelled "Show original".
   */
  getNativeTranslateBar(article) {
    if (!article) return null;
    const text = article.matches?.(POST_TEXT) ? article : article.querySelector?.(POST_TEXT);
    if (!text) return null;
    const inQuote = api.getPostArticle(article) !== article;

    let node = text;
    for (let depth = 0; depth < 6 && node && article.contains?.(node); depth += 1) {
      const hit = nearbySibling(node, (sibling) => {
        if (sibling === text || sibling.contains?.(text)) return false;
        if (sibling.matches?.(POST_TEXT)) return false;
        if (!inQuote && sibling.matches?.(QUOTE_FRAME)) return false;
        // Stay in the text column — skip header chrome (Grok carries a translate glyph).
        if (sibling.querySelector?.('[data-post-avatar], button[aria-haspopup="menu"]')) return false;
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
};

export default {
  id: 'modern',

  detect(root) {
    return Boolean(
      root.querySelector('[data-engagement-action]') ||
        root.querySelector('[data-slot^="xds-"]') ||
        root.querySelector('header[data-page-header]') ||
        root.querySelector('div[id^="urt:"]'),
    );
  },

  api,
  css: {
    article: 'article',
    cell: 'li[data-index]',
    tweetText: '[dir="auto"].whitespace-pre-wrap',
    actionReply: '[data-engagement-action="reply"]',
    actionGroup: '[role="group"]:has(> [data-engagement-action="reply"])',
    primaryColumn: 'main',
    sidebarColumn: 'aside',
    leftNav: 'nav[aria-label]',
    avatar: '[data-post-avatar]',
    userCell: '[data-who-to-follow]',
    verified: '[data-icon*="verified"]',
    // One trend in the sidebar trends module: the new build marks nothing, but each
    // trend links to its search query.
    trend: '[data-trend], a[href*="/search?q="]',
  },
};
