import { SEL } from '../../core/constants.js';
import { ATTR, cfg } from './config.js';

/**
 * Upgrade timeline photos to a larger rendition (`name=large|orig`) so images
 * look sharp on big screens. Only post photos (`pbs.twimg.com/media/…`) are
 * touched — avatars, banners and link cards keep X's own sizes.
 */
const PHOTO_SELECTOR = `${SEL.photo} img[src*="pbs.twimg.com/media/"]`;

export function upgradeFeedImages() {
  const config = cfg();
  const quality = config.enabled ? config.feedImageQuality : 'default';
  if (quality === 'default') return;

  document.querySelectorAll(PHOTO_SELECTOR).forEach((img) => {
    if (img.getAttribute(ATTR.feedImage) === quality) return;
    let url;
    try {
      url = new URL(img.currentSrc || img.src);
    } catch {
      return;
    }
    img.setAttribute(ATTR.feedImage, quality);
    if (url.searchParams.get('name') === quality) return;
    url.searchParams.set('name', quality);
    img.src = url.href;
  });
}
