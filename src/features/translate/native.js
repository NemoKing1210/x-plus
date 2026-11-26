import { dom } from '../../core/compat/index.js';
import { getQuoteCard, getTweetArticle } from './author.js';
import { cfg } from './config.js';

/** X already shows its machine-translation bar for this post/reply. */
export function hasNativeXAutoTranslate(postEl) {
  const boundary = getQuoteCard(postEl) || getTweetArticle(postEl);
  if (!boundary) return false;
  return dom.hasNativeAutoTranslate(boundary);
}

export function shouldSkipForNativeAutoTranslate(postEl) {
  return cfg().skipNativeAutoTranslate !== false && hasNativeXAutoTranslate(postEl);
}
