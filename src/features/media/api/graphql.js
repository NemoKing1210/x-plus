import { gmRequest } from '../../../core/http.js';
import { logInfo } from '../../../core/debug.js';
import { mapMedia } from './model.js';

/**
 * Authenticated fallback: X's own web GraphQL API, called with the viewer's
 * session (cookies + csrf token), exactly like the web client does. Covers
 * tweets the syndication endpoint refuses (sensitive / age-restricted).
 *
 * Fragile by nature: the query id rotates with web client builds (it is
 * discovered from the loaded bundles, with known ids as a fallback) and the
 * feature-flag set must match what the server expects (missing flags reported
 * by the server are filled in and the request is retried once).
 */

/** Public web-client bearer token (same for every visitor, shipped in X's JS). */
const BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const FALLBACK_QUERY_IDS = ['zAz9764BcLZOJ0JU2wrd1A', 'Xl5pC_lBk_gcO2ItU39DQw', '0hWvDhmW8YQ-S_ib3azIrw'];

const FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

let discoveredQueryId = null;

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/** Find the TweetResultByRestId query id in X's own bundles. */
async function discoverQueryId() {
  if (discoveredQueryId) return discoveredQueryId;
  const scripts = [...document.querySelectorAll('script[src]')]
    .map((script) => script.src)
    .filter((src) => /abs\.twimg\.com\/responsive-web\/client-web/.test(src))
    .sort((a, b) => Number(/main\./.test(b)) - Number(/main\./.test(a)))
    .slice(0, 6);

  for (const src of scripts) {
    try {
      const text = await gmRequest({ url: src, responseType: 'text', anonymous: true, timeout: 30000 });
      const match = /queryId:"([^"]+)",operationName:"TweetResultByRestId"/.exec(String(text));
      if (match) {
        discoveredQueryId = match[1];
        logInfo('media', 'discovered TweetResultByRestId query id', discoveredQueryId);
        return discoveredQueryId;
      }
    } catch {
      /* try the next bundle */
    }
  }
  return null;
}

function buildUrl(queryId, tweetId, features) {
  const params = new URLSearchParams({
    variables: JSON.stringify({
      tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: false,
    }),
    features: JSON.stringify(features),
    fieldToggles: JSON.stringify({
      withArticleRichContentState: true,
      withArticlePlainText: false,
      withGrokAnalyze: false,
      withDisallowedReplyControls: false,
    }),
  });
  return `${location.origin}/i/api/graphql/${queryId}/TweetResultByRestId?${params}`;
}

/** @returns {Promise<{status: number, json: any}>} */
async function request(queryId, tweetId, features, csrf) {
  const response = await fetch(buildUrl(queryId, tweetId, features), {
    credentials: 'include',
    headers: {
      authorization: `Bearer ${BEARER}`,
      'x-csrf-token': csrf,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      'content-type': 'application/json',
    },
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    /* non-JSON error page */
  }
  return { status: response.status, json };
}

/** Parse "The following features cannot be null: a, b, c" into flag names. */
function missingFeatures(json) {
  const message = (json?.errors || []).map((e) => e.message || '').join(' ');
  const match = /features cannot be null:\s*([\w,\s]+)/i.exec(message);
  return match ? match[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

async function requestWithFeatureRetry(queryId, tweetId, csrf) {
  const first = await request(queryId, tweetId, FEATURES, csrf);
  if (first.status !== 400) return first;
  const missing = missingFeatures(first.json);
  if (!missing.length) return first;
  const features = { ...FEATURES };
  for (const name of missing) features[name] = true;
  return request(queryId, tweetId, features, csrf);
}

const unwrap = (result) => (result?.__typename === 'TweetWithVisibilityResults' ? result.tweet : result);

function screenName(result) {
  const user = result?.core?.user_results?.result;
  return user?.core?.screen_name || user?.legacy?.screen_name || '';
}

function modelFrom(result) {
  const legacy = result.legacy || {};
  const user = screenName(result);
  const tweet = { id: result.rest_id || legacy.id_str || '', user };
  const entities = legacy.extended_entities?.media || legacy.entities?.media;
  const items = mapMedia(entities, 'main', tweet);

  const quoted = unwrap(result.quoted_status_result?.result);
  if (quoted?.legacy) {
    items.push(
      ...mapMedia(
        quoted.legacy.extended_entities?.media || quoted.legacy.entities?.media,
        'quote',
        { id: quoted.rest_id || '', user: screenName(quoted) },
      ),
    );
  }

  const owner = result.core?.user_results?.result;
  return {
    id: tweet.id,
    user,
    name: owner?.core?.name || owner?.legacy?.name || '',
    createdAt: legacy.created_at || '',
    text: legacy.full_text || '',
    items,
  };
}

/** @returns {Promise<import('./model.js').TweetMedia | null>} */
export async function fetchGraphql(tweetId) {
  const csrf = readCookie('ct0');
  if (!csrf) {
    const error = new Error('Not signed in');
    error.code = 'auth';
    throw error;
  }

  const candidates = [...(discoveredQueryId ? [discoveredQueryId] : []), ...FALLBACK_QUERY_IDS];
  let discoveryTried = Boolean(discoveredQueryId);
  const queue = [...new Set(candidates)];

  while (queue.length) {
    const queryId = queue.shift();
    const { status, json } = await requestWithFeatureRetry(queryId, tweetId, csrf);
    if (status === 401 || status === 403) {
      const error = new Error(`GraphQL auth failed (${status})`);
      error.code = 'auth';
      throw error;
    }
    const result = unwrap(json?.data?.tweetResult?.result);
    if (status === 200 && result) {
      return result.legacy ? modelFrom(result) : null;
    }
    // Unknown query id (rotated) → discover the live one once, then retry.
    if (!queue.length && !discoveryTried) {
      discoveryTried = true;
      const live = await discoverQueryId();
      if (live && !candidates.includes(live)) queue.push(live);
    }
  }
  return null;
}
