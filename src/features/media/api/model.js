import { parseVariants } from '../variants.js';

/**
 * Both data sources (syndication, GraphQL) expose media in the same
 * Twitter-API v1.1 shape (`media_url_https`, `type`, `video_info`, …), so one
 * mapper builds the shared model.
 *
 * @typedef {object} TweetMedia
 * @property {string} id
 * @property {string} user
 * @property {string} name
 * @property {string} createdAt
 * @property {string} text
 * @property {import('../variants.js').MediaItem[]} items
 */

/**
 * @param {object[] | undefined} details - raw media entities
 * @param {'main'|'quote'} owner
 * @param {{ id: string, user: string }} tweet
 * @returns {import('../variants.js').MediaItem[]}
 */
export function mapMedia(details, owner, tweet) {
  if (!Array.isArray(details)) return [];
  return details.map((entity, i) => {
    const type =
      entity.type === 'photo' ? 'photo' : entity.type === 'animated_gif' ? 'gif' : 'video';
    const width = Number(entity.original_info?.width) || 0;
    const height = Number(entity.original_info?.height) || 0;
    const item = {
      owner,
      type,
      index: i + 1,
      tweetId: tweet.id,
      user: tweet.user,
      width,
      height,
      thumb: entity.media_url_https || '',
    };
    if (type === 'photo') {
      item.url = entity.media_url_https || '';
    } else {
      item.variants = parseVariants(entity.video_info, { width, height });
      item.durationMs = Number(entity.video_info?.duration_millis) || 0;
    }
    return item;
  });
}
