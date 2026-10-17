import { QUOTE_HEADER_ROW_SELECTOR, SEL, UI_ATTR } from '../../core/constants.js';
import { getQuoteCard, getTweetArticle } from './author.js';
import { ATTR } from './config.js';

/**
 * Where the translate chrome lives inside X's tweet DOM:
 *
 *  - the Translate **button** sits in the tweet header actions row (before
 *    Grok / caret; at the end of the name row for quote embeds), falling back
 *    to the toolbar under the text when the header cannot be found;
 *  - the **toolbar** (result panel host) is a sibling after the text node, or
 *    the last child of the quote card for quoted tweets.
 */

/** Called for every toolbar that gets created / re-placed (wires its events). */
let toolbarBinder = null;
export function setToolbarBinder(fn) {
  toolbarBinder = fn;
}

/** Real timeline / thread tweet bodies (composer and other chrome excluded). */
export function findPostTextRoots(root = document) {
  const nodes = [];
  root.querySelectorAll(SEL.tweetText).forEach((el) => {
    if (!el.closest?.(SEL.article)) return;
    const nestedParent = el.parentElement?.closest?.(SEL.tweetText);
    if (nestedParent && nestedParent !== el) return;
    nodes.push(el);
  });
  return nodes;
}

function isInQuoteEmbed(el, article) {
  if (!el || !article) return false;
  const quote = el.closest(SEL.quoteTweet);
  return Boolean(quote && article.contains(quote));
}

/**
 * Quote embeds have no Grok / caret — append the control as a *direct child*
 * of the quote header row (avatar | User-Name).
 * @returns {{ row: Element, before: Element | null } | null}
 */
function findQuoteHeaderActionsSlot(postEl) {
  const quote = getQuoteCard(postEl);
  if (!quote) return null;

  const isQuoteHeaderRow = (node) =>
    Boolean(
      node?.querySelector?.(SEL.quoteAvatar) &&
        node?.querySelector?.(SEL.userName) &&
        !node.querySelector?.(SEL.tweetText),
    );

  const bySelector = [...quote.querySelectorAll(QUOTE_HEADER_ROW_SELECTOR)].find(isQuoteHeaderRow);
  if (bySelector) return { row: bySelector, before: null };

  // Structural fallback when X renames atomic row classes.
  const userName = quote.querySelector(SEL.userName);
  if (!userName) return null;
  let node = userName.parentElement;
  while (node && node !== quote) {
    if (isQuoteHeaderRow(node)) {
      const style = getComputedStyle(node);
      const isRow =
        (style.display === 'flex' || style.display === 'inline-flex') &&
        String(style.flexDirection || 'row').startsWith('row');
      if (isRow) return { row: node, before: null };
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Tweet header actions row: Grok + caret (More). Insert our control as a
 * sibling before Grok (or before caret if no Grok).
 * @returns {{ row: Element, before: Element | null } | null}
 */
function findHeaderActionsSlot(postEl) {
  const quoteSlot = findQuoteHeaderActionsSlot(postEl);
  if (quoteSlot) return quoteSlot;

  if (getQuoteCard(postEl)) return null;

  const article = getTweetArticle(postEl);
  if (!article) return null;

  let grokBtn = null;
  for (const btn of article.querySelectorAll('button[aria-label]')) {
    if (isInQuoteEmbed(btn, article)) continue;
    if (/grok/i.test(btn.getAttribute('aria-label') || '')) {
      grokBtn = btn;
      break;
    }
  }

  if (grokBtn?.parentElement?.parentElement) {
    const wrap = grokBtn.parentElement;
    const row = wrap.parentElement;
    if (row && article.contains(row)) return { row, before: wrap };
  }

  const caret = [...article.querySelectorAll(SEL.caret)].find(
    (node) => !isInQuoteEmbed(node, article),
  );
  if (!caret) return null;

  let node = caret;
  while (node.parentElement && node.parentElement !== article) {
    const parent = node.parentElement;
    const style = getComputedStyle(parent);
    const isRow =
      (style.display === 'flex' || style.display === 'inline-flex') &&
      String(style.flexDirection || '').startsWith('row');
    if (isRow && parent.children.length >= 1 && parent.children.length <= 4) {
      const before = [...parent.children].find((child) => child.contains(caret));
      if (before) return { row: parent, before };
    }
    node = parent;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

export function getToolbar(postEl) {
  const child = postEl.querySelector(`[${ATTR.toolbar}]`);
  if (child) return child;
  const sibling = postEl.nextElementSibling;
  if (sibling?.hasAttribute?.(ATTR.toolbar)) return sibling;
  const quote = getQuoteCard(postEl);
  if (quote) {
    const owned = quote.querySelector(`[${ATTR.toolbar}]`);
    if (owned) return owned;
  }
  return null;
}

export function getTranslateButton(postEl) {
  const bar = getToolbar(postEl);
  const inBar = bar?.querySelector(`[${ATTR.button}]`);
  if (inBar) return inBar;

  const scope = getQuoteCard(postEl) || getTweetArticle(postEl);
  if (!scope) return null;
  return (
    scope.querySelector(`.xp-header-action [${ATTR.button}]`) ||
    scope.querySelector(`[${ATTR.button}][data-xp-header="1"]`)
  );
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

export function placeToolbar(postEl, bar) {
  const quote = getQuoteCard(postEl);
  if (quote) {
    if (bar.parentElement !== quote || quote.lastElementChild !== bar) quote.appendChild(bar);
    return;
  }
  if (postEl.nextElementSibling !== bar) postEl.insertAdjacentElement('afterend', bar);
}

export function ensureToolbar(postEl) {
  let bar = getToolbar(postEl);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'xp-toolbar';
    bar.setAttribute(ATTR.toolbar, '1');
    bar.setAttribute(UI_ATTR, '');
  }
  placeToolbar(postEl, bar);
  toolbarBinder?.(bar, postEl);
  return bar;
}

export function placeTranslateButton(postEl, btn) {
  const slot = findHeaderActionsSlot(postEl);
  if (slot) {
    btn.classList.add('xp-btn--header');
    btn.setAttribute('data-xp-header', '1');

    let wrap = btn.closest('.xp-header-action');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'xp-header-action';
      wrap.setAttribute(UI_ATTR, '');
      wrap.appendChild(btn);
    } else if (btn.parentElement !== wrap) {
      wrap.appendChild(btn);
    }
    const inQuote = Boolean(getQuoteCard(postEl));
    wrap.classList.toggle('xp-header-action--quote', inQuote);

    // Quotes: always append as last *direct* child of the header row.
    if (inQuote || !slot.before) {
      if (wrap.parentElement !== slot.row || slot.row.lastElementChild !== wrap) {
        slot.row.appendChild(wrap);
      }
    } else if (wrap.parentElement !== slot.row || wrap.nextElementSibling !== slot.before) {
      slot.row.insertBefore(wrap, slot.before);
    }
    const label = btn.getAttribute('aria-label');
    if (label) btn.title = label;
    return;
  }

  // Fallback: under tweet text (missing header chrome).
  btn.classList.remove('xp-btn--header');
  btn.removeAttribute('data-xp-header');
  const orphanWrap = btn.closest('.xp-header-action');
  const bar = ensureToolbar(postEl);
  if (orphanWrap) orphanWrap.replaceWith(btn);
  if (btn.parentElement !== bar) bar.insertBefore(btn, bar.firstChild);
}
