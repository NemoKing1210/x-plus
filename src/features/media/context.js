import { dom } from '../../core/compat/index.js';
import { handleFromHref } from '../../utils/handle.js';

/**
 * What a download or a copy needs to know about the post a photo belongs to.
 * X-specific structure comes from the compat layer; only the meaning of the
 * fields lives here.
 */

/** Permalink of a post inside an X href. */
const STATUS_RE = /\/status\/(\d+)/;

/** Status id from a post permalink, else from the page path (status pages). */
export function statusId(href, path = typeof location === 'undefined' ? '' : location.pathname) {
  const match = STATUS_RE.exec(href || '') || STATUS_RE.exec(path || '');
  return match ? match[1] : '';
}

/** First profile link inside `scope` that is not a post permalink. */
export function handleInScope(scope) {
  if (!scope) return '';
  for (const link of scope.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href') || '';
    if (STATUS_RE.test(href)) continue;
    const handle = handleFromHref(href);
    if (handle) return handle;
  }
  return '';
}

/**
 * Author, time, text and id of the post the clicked photo belongs to. A photo
 * inside a quote reports the quoted post, not the post quoting it.
 * @param {Element} article post article around the photo
 * @param {Element} host the media host that was clicked
 * @param {'main'|'quote'} owner whether that host belongs to the post or its quote
 * @returns {{ id: string, user: string, createdAt: string, text: string }}
 */
export function postContext(article, host, owner, api = dom) {
  if (owner === 'quote') {
    const quote = api.getQuoteCard(host, article);
    return {
      id: '',
      user: handleInScope(quote),
      createdAt: '',
      text: quote ? api.getTextRoots(quote)[0]?.textContent || '' : '',
    };
  }
  const link = api.getTimeLink(article);
  return {
    id: statusId(link?.getAttribute('href')),
    user: handleFromHref(link?.getAttribute('href')),
    createdAt: link?.querySelector('time')?.getAttribute('datetime') || '',
    text: api.getPostText(article)?.textContent || '',
  };
}

/**
 * The post article and the media host around a click, or null when the click
 * missed both (a click on the post text, the action bar, …).
 * @returns {{ article: Element, host: { el: Element, kind: string, owner: string } } | null}
 */
export function mediaHostAt(target, api = dom) {
  const article = api.getPostArticle(target);
  if (!article) return null;
  const host = api
    .getMediaHosts(article)
    .find((candidate) => candidate.el === target || candidate.el.contains?.(target));
  return host ? { article, host } : null;
}
