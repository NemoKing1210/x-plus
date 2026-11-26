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

import { AD_ICON_PATH_PREFIX, AD_LABELS, normalizeHandleText } from './shared.js';

const QUOTE_FRAME = '[data-slot="embedded-tweet-frame"]';
const POST_TEXT = '[dir="auto"].whitespace-pre-wrap';
const MEDIA_HOST = '[data-engagement-action="media"]';
const LINK_CARD = '[data-testid="card.wrapper"]';
const POLL = '[data-testid="card.poll"], [role="radiogroup"]';
const ARTICLE_COVER = '[data-testid="article-cover-image"], a[href*="/i/article/"] img';
const VERIFIED = 'svg[data-icon*="verified"], [data-testid="icon-verified"]';

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

  /** Smallest ancestor of the avatar that also carries the author name and a post link. */
  getAuthorHeader(article) {
    const avatar = api.getAuthorAvatar(article);
    if (!avatar) return null;
    for (let node = avatar.parentElement; node; node = node.parentElement) {
      if (node.querySelector?.('a[href*="/status/"]') && node.querySelector?.('div[dir="auto"]')) return node;
      if (node === article) break;
    }
    return null;
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
    primaryColumn: 'main',
    sidebarColumn: 'aside',
    leftNav: 'nav[aria-label]',
    avatar: '[data-post-avatar]',
    userCell: '[data-who-to-follow]',
    verified: '[data-icon*="verified"]',
  },
};
