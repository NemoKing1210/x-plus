import { dom } from '../../core/compat/index.js';
import { UI_ATTR } from '../../core/constants.js';
import { normalizeHandle } from '../../utils/handle.js';

/**
 * DOM facts for one post, read-only. X renders emoji (including flags) as
 * `<img alt>` / `[role="img"][aria-label]`, so plain `textContent` would lose
 * the very thing users filter by. `plainText` walks the tree and substitutes
 * those labels without touching X's nodes.
 *
 * X's structure comes from the compat layer; only the reading lives here.
 */

/** Read-only, emoji-aware text; lower-cased and whitespace-collapsed. */
export function plainText(root) {
  let out = '';
  const walk = (node) => {
    if (node.nodeType === 3) {
      out += node.nodeValue;
      return;
    }
    if (node.nodeType !== 1) return;
    // Icons are SVGs (the verified badge among them): their labels are not the author's text.
    if (String(node.tagName).toLowerCase() === 'svg') return;
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
  const primary = dom.getPrimaryColumn(doc);
  return primary ? dom.getArticles(primary)[0] || null : null;
}

/**
 * @param {Element} article
 * @param {Element|null} focal the page's focal post, resolved once per pass:
 *   re-resolving it for every post would scan the whole column again.
 * @returns {null | {authorName: string, handle: string, text: string, lang: string,
 *   media: Set<string>, attachments: Set<string>, meta: Set<string>}}
 */
export function readPost(article, focal = focalArticleFor()) {
  if (!article?.isConnected) return null;
  if (article.closest(`[role="dialog"], [${UI_ATTR}]`)) return null;
  if (article === focal) return null;

  const embedded = dom.getAttachments(article);
  const header = dom.getAuthorHeader(article);

  const textNode = dom.getPostText(article);
  const text = textNode ? plainText(textNode) : '';
  const lang = (textNode?.getAttribute('lang') || '').toLowerCase();

  const authorName = dom.getAuthorName(article) || (header ? plainText(header) : plainText(article));
  const handle = normalizeHandle(dom.getAuthorHandle(article));

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
