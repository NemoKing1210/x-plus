import { gmRequest } from '../../../core/http.js';
import { mapMedia } from './model.js';

/**
 * Public syndication endpoint used by embedded tweets. No login, no cookies,
 * no rotating query ids — the preferred source. It does not return every
 * tweet (age-restricted / protected ones), in which case callers fall back
 * to GraphQL.
 */

const ENDPOINT = 'https://cdn.syndication.twimg.com/tweet-result';

/** Token expected by the endpoint (derived from the id; algorithm used by react-tweet). */
export function syndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, '');
}

/** @returns {Promise<import('./model.js').TweetMedia | null>} */
export async function fetchSyndication(id) {
  const url = `${ENDPOINT}?id=${encodeURIComponent(id)}&lang=en&token=${syndicationToken(id)}`;
  const data = await gmRequest({
    url,
    responseType: 'json',
    anonymous: true,
    timeout: 15000,
    allow404: true,
  });
  if (!data || typeof data !== 'object' || data.__typename === 'TweetTombstone') return null;

  const user = data.user?.screen_name || '';
  const tweet = { id: data.id_str || String(id), user };
  const items = mapMedia(data.mediaDetails, 'main', tweet);

  const quoted = data.quoted_tweet;
  if (quoted) {
    items.push(
      ...mapMedia(quoted.mediaDetails, 'quote', {
        id: quoted.id_str || '',
        user: quoted.user?.screen_name || '',
      }),
    );
  }

  return {
    id: tweet.id,
    user,
    name: data.user?.name || '',
    createdAt: data.created_at || '',
    text: data.text || '',
    items,
  };
}
