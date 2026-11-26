import { ATTR, cfg } from './config.js';
import { feedPhotoImages } from './photos.js';

/**
 * Upgrade timeline photos to a larger rendition (`name=large|orig`) so images
 * look sharp on big screens. Only post photos (`pbs.twimg.com/media/…`) are
 * touched — avatars, banners and link cards keep X's own sizes.
 */

export function upgradeFeedImages() {
  const config = cfg();
  const quality = config.enabled ? config.feedImageQuality : 'default';
  if (quality === 'default') {
    restoreFeedImages();
    return;
  }

  for (const img of feedPhotoImages()) {
    if (img.getAttribute(ATTR.feedImage) === quality) continue;
    let url;
    try {
      url = new URL(img.currentSrc || img.src);
    } catch {
      continue;
    }
    // Remember the original rendition once, so switching back to "default"
    // (or turning the feature off) can undo the upgrade.
    if (!img.hasAttribute(ATTR.feedImageOrig)) {
      img.setAttribute(ATTR.feedImageOrig, img.getAttribute('src') || '');
    }
    img.setAttribute(ATTR.feedImage, quality);
    if (url.searchParams.get('name') === quality) continue;
    url.searchParams.set('name', quality);
    img.src = url.href;
  }
}

/** Put back the rendition X itself requested (feature off / quality "default"). */
function restoreFeedImages() {
  document.querySelectorAll(`img[${ATTR.feedImageOrig}]`).forEach((img) => {
    const original = img.getAttribute(ATTR.feedImageOrig);
    img.removeAttribute(ATTR.feedImageOrig);
    img.removeAttribute(ATTR.feedImage);
    if (!original) return;
    try {
      // X occasionally reuses an <img> node for a different photo: only restore
      // when the URL still points at the same file.
      const current = new URL(img.src, location.href);
      const target = new URL(original, location.href);
      if (current.pathname !== target.pathname) return;
      if (img.src !== original) img.src = original;
    } catch {
      /* malformed URL: leave X's value alone */
    }
  });
}
