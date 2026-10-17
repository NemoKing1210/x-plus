import { Codes, fail, logInfo, logWarn } from '../../../core/debug.js';
import { fetchGraphql } from './graphql.js';
import { fetchSyndication } from './syndication.js';

/**
 * Resolve the downloadable media of a post.
 *
 * 1. Syndication endpoint — anonymous, stable (preferred).
 * 2. X web GraphQL with the viewer's session — fallback for posts the first
 *    source does not return media for.
 *
 * Results are memoized for a few minutes: repeated clicks and re-opened
 * pickers never refetch.
 */

const TTL_MS = 10 * 60 * 1000;
/** @type {Map<string, { at: number, promise: Promise<import('./model.js').TweetMedia> }>} */
const memo = new Map();

async function resolve(id) {
  let primaryError = null;

  try {
    const model = await fetchSyndication(id);
    if (model?.items.length) return model;
    logInfo('media', 'syndication returned no media, trying GraphQL', { id });
  } catch (error) {
    primaryError = error;
    logInfo('media', 'syndication failed, trying GraphQL', { id, error });
  }

  try {
    const model = await fetchGraphql(id);
    if (model) return model;
  } catch (error) {
    if (!primaryError) primaryError = error;
    logWarn(Codes.MEDIA_RESOLVE, 'GraphQL media lookup failed', { id, error });
  }

  if (primaryError) {
    throw fail(Codes.MEDIA_RESOLVE, 'could not load post media', { id }, primaryError);
  }
  // Both sources answered but found no media.
  return { id, user: '', name: '', createdAt: '', text: '', items: [] };
}

/** @returns {Promise<import('./model.js').TweetMedia>} */
export function resolveTweetMedia(id) {
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const promise = resolve(id);
  memo.set(id, { at: Date.now(), promise });
  // Do not keep failures: the next click should retry.
  promise.catch(() => memo.delete(id));
  return promise;
}
