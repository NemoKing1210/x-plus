import { dom } from '../../core/compat/index.js';

/**
 * Reading media-related facts out of a tweet `<article>`. All X-specific DOM
 * knowledge for the media feature lives here (selectors in core/constants.js).
 */

const STATUS_RE = /\/status\/(\d+)/;

/** True when `node` sits inside a quoted tweet embedded in `article`. */
export function isInQuote(node, article) {
  return Boolean(dom.getQuoteCard(node, article));
}

/**
 * Status id of the tweet an article represents: the permalink of the first
 * timestamp outside any quote embed; falls back to the current URL on a
 * status page.
 */
export function getTweetId(article) {
  for (const time of article.querySelectorAll('a[href*="/status/"] time')) {
    if (isInQuote(time, article)) continue;
    const match = STATUS_RE.exec(time.closest('a')?.getAttribute('href') || '');
    if (match) return match[1];
  }
  for (const link of article.querySelectorAll('a[href*="/status/"]')) {
    if (isInQuote(link, article)) continue;
    const match = STATUS_RE.exec(link.getAttribute('href') || '');
    if (match) return match[1];
  }
  const fromUrl = STATUS_RE.exec(location.pathname);
  return fromUrl ? fromUrl[1] : null;
}

/** Action bar (reply / repost / like / …) of the tweet itself, not of a quote. */
export function getActionGroup(article) {
  return dom.getActionGroup(article);
}

/**
 * Elements that carry media in an article.
 * @returns {{ el: Element, kind: 'video' | 'photo', owner: 'main' | 'quote' }[]}
 */
export function getMediaHosts(article) {
  return dom.getMediaHosts(article);
}

/**
 * An animated GIF is an inline `<video loop>` in X's DOM: it must honour the
 * `gifs` switch, not the `videos` one.
 */
export function isGifHost(host) {
  if (!host || host.kind !== 'video') return false;
  const el = host.el;
  const video = el.matches?.('video') ? el : el.querySelector?.('video');
  return Boolean(video?.loop);
}

/**
 * Index (1-based) of a photo host among the photos of the same owner —
 * matches the order of `mediaDetails` in the API response.
 */
export function photoIndex(article, host) {
  const photos = getMediaHosts(article).filter(
    (candidate) => candidate.kind === 'photo' && candidate.owner === host.owner,
  );
  return photos.findIndex((candidate) => candidate.el === host.el) + 1;
}
