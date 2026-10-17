import {
  formatHandleDisplay,
  handleFromHref,
  normalizeHandle,
} from '../../utils/handle.js';

/** Closest tweet article for a text node. */
export function getTweetArticle(postEl) {
  if (!postEl || !(postEl instanceof Element)) return null;
  return postEl.closest('article[data-testid="tweet"]');
}

/**
 * Quote / embed container that owns `postEl` when this text is a quoted tweet
 * nested inside an outer article (not the outer tweet’s own text).
 */
export function getQuoteCard(postEl) {
  if (!postEl || !(postEl instanceof Element)) return null;
  const article = getTweetArticle(postEl);
  if (!article) return null;

  const texts = [...article.querySelectorAll('[data-testid="tweetText"]')];
  if (texts.length < 2) return null;
  if (texts[0] === postEl) return null;

  // Quoted tweet body lives under a nested link/card inside the outer article.
  const quote =
    postEl.closest('[data-testid="quoteTweet"]') ||
    postEl.closest('div[role="link"]') ||
    null;
  if (!quote || !article.contains(quote)) return null;
  if (!quote.contains(postEl)) return null;
  return quote;
}

function resolveHandleFromScope(scope) {
  if (!scope) return null;

  const userName = scope.querySelector('[data-testid="User-Name"]');
  if (userName) {
    for (const link of userName.querySelectorAll('a[href]')) {
      const handle = handleFromHref(link.getAttribute('href'));
      if (handle) return handle;
    }
  }

  for (const link of scope.querySelectorAll('a[href^="/"]')) {
    const href = link.getAttribute('href') || '';
    if (/\/status\//i.test(href)) continue;
    const handle = handleFromHref(href);
    if (handle) return handle;
  }

  return null;
}

/**
 * Resolve the post author's handle from a tweet text node (or nearby card).
 */
export function resolvePostAuthorHandle(postEl) {
  if (!postEl || !(postEl instanceof Element)) return null;

  const quote = getQuoteCard(postEl);
  if (quote) {
    const fromQuote = resolveHandleFromScope(quote);
    if (fromQuote) return fromQuote;
  }

  const article = getTweetArticle(postEl);
  if (article) {
    // Walk User-Name blocks; first one outside the quote card is the author.
    for (const userName of article.querySelectorAll('[data-testid="User-Name"]')) {
      if (quote && quote.contains(userName)) continue;
      const handle = resolveHandleFromScope(userName);
      if (handle) return handle;
    }
    return resolveHandleFromScope(article);
  }

  return resolveHandleFromScope(postEl.parentElement);
}

/** Author handle for the tweet whose caret menu is open. */
export function resolveHandleFromDropdownTrigger(trigger) {
  if (!trigger || !(trigger instanceof Element)) return null;

  const article = trigger.closest('article[data-testid="tweet"]');
  if (article) {
    const tweetText = article.querySelector('[data-testid="tweetText"]');
    if (tweetText) return resolvePostAuthorHandle(tweetText);
    return resolveHandleFromScope(article);
  }

  return null;
}

export { formatHandleDisplay, normalizeHandle };
