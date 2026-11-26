/**
 * Legacy X DOM profile (`data-testid` markup).
 *
 * This is the reference implementation: it carries the selectors and
 * structural helpers that used to live in `core/constants.js` and the feature
 * modules. Features call the capabilities through `core/compat/index.js`.
 */

import { normalizeHandleText } from './shared.js';

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

/** A header actions row (Grok + caret) is a few icons wide; the whole name row is not. */
const COMPACT_ACTIONS_ROW_MAX_WIDTH = 120;

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
    const candidates = article.querySelectorAll(
      '[data-testid^="UserAvatar-Container"], [data-testid="Tweet-User-Avatar"]',
    );
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
  css: {},
};
