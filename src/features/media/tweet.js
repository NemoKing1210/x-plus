import { SEL } from '../../core/constants.js';

/**
 * Reading media-related facts out of a tweet `<article>`. All X-specific DOM
 * knowledge for the media feature lives here (selectors in core/constants.js).
 */

const STATUS_RE = /\/status\/(\d+)/;

/** Elements that play inline video / GIFs. */
const VIDEO_HOST_SELECTOR = `${SEL.videoPlayer}, [data-testid="videoComponent"]`;

/** True when `node` sits inside a quoted tweet embedded in `article`. */
export function isInQuote(node, article) {
  const quote = node.closest(SEL.quoteTweet);
  return Boolean(quote && article.contains(quote));
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
  const reply = article.querySelector(SEL.actionReply);
  return reply?.closest('[role="group"]') || null;
}

/**
 * Elements that carry media in an article.
 * @returns {{ el: Element, kind: 'video' | 'photo', owner: 'main' | 'quote' }[]}
 */
export function getMediaHosts(article) {
  const hosts = [];
  const seen = new Set();
  const push = (el, kind) => {
    if (seen.has(el)) return;
    seen.add(el);
    hosts.push({ el, kind, owner: isInQuote(el, article) ? 'quote' : 'main' });
  };

  article.querySelectorAll(VIDEO_HOST_SELECTOR).forEach((el) => push(el, 'video'));
  article.querySelectorAll(SEL.photo).forEach((el) => {
    // A video wrapped in tweetPhoto (GIFs) is already covered above.
    if (el.querySelector('video') || el.closest(VIDEO_HOST_SELECTOR)) return;
    if (el.querySelector('img')) push(el, 'photo');
  });
  return hosts;
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
