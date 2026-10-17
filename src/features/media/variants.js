/**
 * Media model + quality selection.
 *
 * @typedef {object} VideoVariant
 * @property {string} url
 * @property {number} bitrate   - bits per second (0 for GIFs)
 * @property {number} width
 * @property {number} height
 * @property {number} quality   - short side in px (720 for 1280x720 and 720x1280), 0 if unknown
 *
 * @typedef {object} MediaItem
 * @property {'main'|'quote'} owner
 * @property {'video'|'gif'|'photo'} type
 * @property {number} index     - 1-based position inside its tweet
 * @property {string} tweetId
 * @property {string} user      - screen name of the tweet author
 * @property {number} width
 * @property {number} height
 * @property {number} [durationMs]
 * @property {string} thumb
 * @property {string} [url]     - photos: base image url
 * @property {VideoVariant[]} [variants] - videos / GIFs, best first
 */

const SIZE_IN_URL = /\/(\d{2,5})x(\d{2,5})\//;

/**
 * mp4 variants of a `video_info` block, best (highest bitrate) first.
 * HLS playlists are ignored: they need muxing and are not directly savable.
 * @returns {VideoVariant[]}
 */
export function parseVariants(videoInfo, fallbackSize = {}) {
  const list = Array.isArray(videoInfo?.variants) ? videoInfo.variants : [];
  const variants = [];
  for (const variant of list) {
    const type = variant.content_type || variant.type || '';
    const url = variant.url || variant.src || '';
    if (!url || !/video\/mp4/i.test(type)) continue;
    const size = SIZE_IN_URL.exec(url);
    const width = size ? Number(size[1]) : Number(fallbackSize.width) || 0;
    const height = size ? Number(size[2]) : Number(fallbackSize.height) || 0;
    variants.push({
      url,
      bitrate: Number(variant.bitrate) || 0,
      width,
      height,
      quality: width && height ? Math.min(width, height) : 0,
    });
  }
  return variants.sort((a, b) => b.bitrate - a.bitrate || b.quality - a.quality);
}

/** Quality caps for the "max N p" rules. */
const CAPS = { 1080: 1080, 720: 720, 480: 480 };

/**
 * Pick one variant by rule: `best`, `lowest`, or a cap (`1080` / `720` / `480`
 * → the best variant not above the cap, else the smallest available).
 * @param {VideoVariant[]} variants best first
 * @param {string} rule
 */
export function pickVariant(variants, rule) {
  if (!variants.length) return null;
  if (rule === 'lowest') return variants[variants.length - 1];
  const cap = CAPS[rule];
  if (!cap) return variants[0];
  const fits = variants.filter((v) => !v.quality || v.quality <= cap);
  return fits[0] || variants[variants.length - 1];
}

export function qualityLabel(variant) {
  return variant.quality ? `${variant.quality}p` : '';
}

/** Build the original-size photo url (`name` = orig | large | 4096x4096 …). */
export function photoUrl(baseUrl, name = 'orig') {
  const match = /^(https?:\/\/[^?#]+?)\.(jpe?g|png|webp|gif)(?:[?#].*)?$/i.exec(baseUrl);
  if (!match) return baseUrl;
  const format = match[2].toLowerCase() === 'jpeg' ? 'jpg' : match[2].toLowerCase();
  return `${match[1]}?format=${format}&name=${name}`;
}

export function photoExtension(baseUrl) {
  const match = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.exec(baseUrl);
  if (!match) return 'jpg';
  const ext = match[1].toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}
