import { SEL, UI_ATTR } from '../../core/constants.js';
import { normalizeHandle } from '../../utils/handle.js';
import { isPromotedArticle, quoteCardOf } from '../interface/rules.js';

/**
 * DOM facts for one post, read-only. X renders emoji (including flags) as
 * `<img alt>` / `[role="img"][aria-label]`, so plain `textContent` would lose
 * the very thing users filter by. `plainText` walks the tree and substitutes
 * those labels without touching X's nodes.
 *
 * Selectors live here: X's markup changes often, keep fixes one line.
 */

const POLL = '[data-testid="card.poll"], [data-testid="poll"]';
const LINK_CARD = '[data-testid="card.wrapper"]';
const ARTICLE_COVER = '[data-testid="article-cover-image"]';
const VERIFIED = '[data-testid="icon-verified"]';
const SOCIAL_CONTEXT = '[data-testid="socialContext"]';
const VIDEO = `${SEL.videoPlayer}, [data-testid="previewInterstitial"]`;

/** Read-only, emoji-aware text; lower-cased and whitespace-collapsed. */
function plainText(root) {
  let out = '';
  const walk = (node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue;
      return;
    }
    if (node.nodeType !== 1) return;
    // Badge SVGs carry aria-labels ("Verified account") we do not want in a name.
    if (node.matches(VERIFIED)) return;
    if (node.tagName === 'IMG') {
      out += node.getAttribute('alt') || '';
      return;
    }
    if (node.getAttribute('role') === 'img') {
      const label = node.getAttribute('aria-label') || '';
      if (label) {
        out += label;
        return;
      }
    }
    for (const child of node.childNodes) walk(child);
  };
  walk(root);
  return out.replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Cards of posts quoted inside `article` (legacy test id or avatar-based). */
function quoteCards(article) {
  const cards = new Set(article.querySelectorAll(SEL.quoteTweet));
  for (const avatar of article.querySelectorAll(SEL.quoteAvatar)) {
    const card = quoteCardOf(avatar, article);
    if (card) cards.add(card);
  }
  return [...cards];
}

/** First User-Name header that belongs to the post itself. */
function outerHeader(article, quotes) {
  for (const header of article.querySelectorAll(SEL.userName)) {
    if (!quotes.some((card) => card.contains(header))) return header;
  }
  return null;
}

/* The focal post on a status page must never be filtered. Resolve the first
 * article of the primary column once per path. */
let focalPath = '';
let focalArticle = null;

function isFocal(article) {
  if (!location.pathname.includes('/status/')) return false;
  if (focalPath !== location.pathname) {
    focalPath = location.pathname;
    focalArticle = document.querySelector(`${SEL.primaryColumn} ${SEL.article}`);
  }
  return article === focalArticle;
}

/**
 * @param {Element} article
 * @returns {null | {authorName: string, handle: string, text: string, lang: string,
 *   media: Set<string>, attachments: Set<string>, meta: Set<string>}}
 */
export function readPost(article) {
  if (!article?.isConnected) return null;
  if (article.closest(`[role="dialog"], [${UI_ATTR}]`)) return null;
  if (isFocal(article)) return null;

  const quotes = quoteCards(article);
  const quoted = (node) => quotes.some((card) => card.contains(node));
  const header = outerHeader(article, quotes);

  const textNode = [...article.querySelectorAll(SEL.tweetText)].find((node) => !quoted(node)) || null;
  const text = textNode ? plainText(textNode) : '';
  const lang = (textNode?.getAttribute('lang') || '').toLowerCase();

  let authorName = '';
  let handle = '';
  if (header) {
    const anchors = [...header.querySelectorAll('a[href]')];
    const nameAnchor = anchors.find((anchor) => !plainText(anchor).startsWith('@'));
    authorName = plainText(nameAnchor || header);
    const handleNode =
      anchors.find((anchor) => plainText(anchor).startsWith('@')) ||
      [...header.querySelectorAll('span')].find((span) => plainText(span).startsWith('@'));
    handle = normalizeHandle(handleNode ? plainText(handleNode) : '');
  } else {
    authorName = plainText(article);
  }

  const media = new Set();
  for (const node of article.querySelectorAll(`${SEL.photo}, ${VIDEO}`)) {
    if (quoted(node)) continue;
    media.add(node.matches(VIDEO) || node.querySelector(VIDEO) ? 'video' : 'photo');
  }

  const attachments = new Set();
  if (quotes.length) attachments.add('quote');
  for (const [selector, kind] of [
    [LINK_CARD, 'link'],
    [POLL, 'poll'],
    [ARTICLE_COVER, 'article'],
  ]) {
    if ([...article.querySelectorAll(selector)].some((node) => !quoted(node))) {
      attachments.add(kind);
    }
  }

  const meta = new Set();
  if (isPromotedArticle(article)) meta.add('promoted');
  if (header?.querySelector(VERIFIED)) meta.add('verified');
  const cell = article.closest(SEL.cell);
  if (cell?.querySelector(SOCIAL_CONTEXT)) meta.add('context');

  return { authorName, handle, text, lang, media, attachments, meta };
}
