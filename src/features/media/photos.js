import { dom } from '../../core/compat/index.js';

/**
 * Post photos are served from `pbs.twimg.com/media/…`; avatars, banners and
 * link-card images are not, so this marker separates them inside a media host
 * the compat layer already resolved.
 */
export const PHOTO_IMG = 'img[src*="pbs.twimg.com/media/"]';

/**
 * The photo a click landed on inside a media host. A host usually holds one
 * photo, but a modern photo grid packs several into one media block, so the
 * click has to pick one: the image itself or the wrapper around it.
 * @returns {HTMLImageElement | null}
 */
export function photoAt(host, target) {
  const images = [...host.querySelectorAll(PHOTO_IMG)];
  if (images.length <= 1) return images[0] || null;
  return (
    images.find(
      (img) => img === target || img.contains?.(target) || img.parentElement?.contains?.(target),
    ) || images[0]
  );
}

/**
 * Images of the post photos under `root`, each once. Quotes count: their photos
 * are post photos too.
 * @returns {HTMLImageElement[]}
 */
export function feedPhotoImages(root = document, api = dom) {
  const images = new Set();
  for (const article of api.getArticles(root)) {
    for (const host of api.getMediaHosts(article)) {
      if (host.kind !== 'photo') continue;
      for (const img of host.el.querySelectorAll(PHOTO_IMG)) images.add(img);
    }
  }
  return [...images];
}
