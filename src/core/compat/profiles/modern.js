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

import { normalizeHandleText } from './shared.js';

const QUOTE_FRAME = '[data-slot="embedded-tweet-frame"]';
const POST_TEXT = '[dir="auto"].whitespace-pre-wrap';

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
