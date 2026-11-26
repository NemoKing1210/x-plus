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

/** True when `el` sits inside a quote card that belongs to `article`. */
function outsideQuote(el, article) {
  if (!el) return false;
  const quote = el.closest?.(SEL.quoteTweet);
  return !quote || !article?.contains?.(quote);
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
