import { dom } from '../../core/compat/index.js';
import { SEL, UI_ATTR } from '../../core/constants.js';
import { normalizeHandle } from '../../utils/handle.js';

/**
 * DOM facts for one post, read-only. X renders emoji (including flags) as
 * `<img alt>` / `[role="img"][aria-label]`, so plain `textContent` would lose
 * the very thing users filter by. `plainText` walks the tree and substitutes
 * those labels without touching X's nodes.
 *
 * Selectors live here: X's markup changes often, keep fixes one line.
 */

const VERIFIED = '[data-testid="icon-verified"]';

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

/**
 * The focal post on a status page is the first article of the primary column.
 * Resolve it on every call: SPA navigation fires `navigate` while the old
 * timeline is still mounted, so a per-path cache would point at a post that is
 * about to be replaced — and the real focal post would then be hidden.
 */
export function focalArticleFor(doc = document, pathname = location.pathname) {
  if (!pathname.includes('/status/')) return null;
  return doc.querySelector(`${SEL.primaryColumn} ${SEL.article}`);
}

/**
 * @param {Element} article
 * @returns {null | {authorName: string, handle: string, text: string, lang: string,
 *   media: Set<string>, attachments: Set<string>, meta: Set<string>}}
 */
export function readPost(article) {
  if (!article?.isConnected) return null;
  if (article.closest(`[role="dialog"], [${UI_ATTR}]`)) return null;
  if (article === focalArticleFor()) return null;

  const embedded = dom.getAttachments(article);
  const quotes = embedded.filter((item) => item.kind === 'quote').map((item) => item.el);
  const quoted = (node) => quotes.some((card) => card.contains(node));
  const header = dom.getAuthorHeader(article);

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
  for (const host of dom.getMediaHosts(article)) {
    if (host.owner === 'main') media.add(host.kind);
  }

  const attachments = new Set();
  for (const item of embedded) {
    if (item.owner === 'main') attachments.add(item.kind);
  }

  const meta = new Set();
  if (dom.isPromotedArticle(article)) meta.add('promoted');
  if (dom.getVerifiedBadge(article)) meta.add('verified');
  if (dom.getSocialContext(article)) meta.add('context');

  return { authorName, handle, text, lang, media, attachments, meta };
}
