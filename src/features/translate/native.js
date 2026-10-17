import { NATIVE_AUTO_TRANSLATE_ICON_PATH, SEL } from '../../core/constants.js';
import { getQuoteCard, getTweetArticle } from './author.js';
import { ATTR, cfg } from './config.js';

/** Aria-labels for X's Show original / about-auto-translate (locale fallback). */
const NATIVE_AUTO_TRANSLATE_LABEL_RE =
  /^(show original|показать оригинал|mostrar (el )?original|afficher l['’]original|original anzeigen|mostra (l['’])?originale|オリジナルを表示|显示原文|顯示原文|mostrar original|about automatic translation|об автоматическом переводе|acerca de la traducci[oó]n autom[aá]tica|à propos de la traduction automatique|informationen zur automatischen [üu]bersetzung|informazioni sulla traduzione automatica|自動翻訳について|关于自动翻译|關於自動翻譯|sobre a tradu[cç][aã]o autom[aá]tica)$/i;

function isOurTranslateChrome(el) {
  return Boolean(
    el?.closest?.(
      `[${ATTR.toolbar}], [${ATTR.button}], [${ATTR.result}], .xp-header-action, .xp-btn`,
    ),
  );
}

/** Native auto-translate bar lives as a sibling under a shared parent with tweet text. */
function isNativeAutoTranslateChrome(root) {
  if (!root || !(root instanceof Element) || isOurTranslateChrome(root)) return false;
  // Never treat another tweet body / nested quote as this post's bar.
  if (root.matches?.(SEL.tweetText)) return false;
  if (root.querySelector?.(`:scope > ${SEL.tweetText}`)) return false;
  if (root.matches?.(SEL.quoteTweet)) return false;

  for (const path of root.querySelectorAll('svg path[d]')) {
    if (isOurTranslateChrome(path)) continue;
    if ((path.getAttribute('d') || '').includes(NATIVE_AUTO_TRANSLATE_ICON_PATH)) return true;
  }

  for (const btn of root.querySelectorAll('button[aria-label]')) {
    if (isOurTranslateChrome(btn)) continue;
    const label = (btn.getAttribute('aria-label') || '').trim();
    if (NATIVE_AUTO_TRANSLATE_LABEL_RE.test(label)) return true;
  }
  return false;
}

/**
 * Visit previous/next element siblings of `node` (near tweet text only).
 * X places its auto-translate bar as a *previous* sibling of tweetText;
 * Grok in the header reuses the same SVG glyph — do not scan the whole article.
 */
function eachNearbySibling(node, visit) {
  for (const prop of ['previousElementSibling', 'nextElementSibling']) {
    let sibling = node[prop];
    while (sibling) {
      if (visit(sibling) === true) return true;
      sibling = sibling[prop];
    }
  }
  return false;
}

/** X already shows its machine-translation bar for this post/reply. */
export function hasNativeXAutoTranslate(postEl) {
  const quote = getQuoteCard(postEl);
  const article = getTweetArticle(postEl);
  const boundary = quote || article;
  if (!boundary) return false;

  let node = postEl;
  for (let depth = 0; depth < 6 && node && boundary.contains(node); depth += 1) {
    const hit = eachNearbySibling(node, (sibling) => {
      if (sibling === postEl || sibling.contains?.(postEl)) return false;
      if (sibling.matches?.(SEL.tweetText)) return false;
      if (!quote && sibling.matches?.(SEL.quoteTweet)) return false;
      // Stay in the text column — skip header chrome (Grok uses the same glyph).
      if (sibling.querySelector?.(`${SEL.userName}, ${SEL.caret}`)) return false;
      return isNativeAutoTranslateChrome(sibling);
    });
    if (hit) return true;
    if (node === boundary) break;
    node = node.parentElement;
  }
  return false;
}

export function shouldSkipForNativeAutoTranslate(postEl) {
  return cfg().skipNativeAutoTranslate !== false && hasNativeXAutoTranslate(postEl);
}
