import { dom } from '../../core/compat/index.js';
import { UI_ATTR } from '../../core/constants.js';
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
  return dom.getTextRoots(root);
}

/**
 * Tweet header actions row: Grok + caret (More). Insert our control as a
 * sibling before Grok (or before caret if no Grok). Quote embeds take the end
 * of their header row instead.
 * @returns {{ row: Element, before: Element | null } | null}
 */
export function findHeaderActionsSlot(postEl) {
  return dom.getHeaderActionsSlot(postEl);
}

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

export function getToolbar(postEl) {
  const child = postEl.querySelector(`[${ATTR.toolbar}]`);
  if (child) return child;

  // X sometimes inserts notices between the text and our toolbar: look through
  // a few siblings, but stop at anything that belongs to another tweet.
  const parent = postEl.parentElement;
  if (parent) {
    for (let node = postEl.nextElementSibling; node; node = node.nextElementSibling) {
      if (node.hasAttribute?.(ATTR.toolbar)) return node;
      // Anything that is (or contains) another post belongs to a different tweet.
      if (node.matches?.('article') || node.querySelector?.('article')) break;
    }
  }

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

/**
 * Put `btn` into a header slot (wrapped in .xp-header-action). Shared by posts
 * and articles. Quote embeds always take the last position of the row.
 */
export function mountHeaderButton(slot, btn, inQuote = false) {
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
  wrap.classList.toggle('xp-header-action--quote', inQuote);

  if (inQuote || !slot.before) {
    if (wrap.parentElement !== slot.row || slot.row.lastElementChild !== wrap) {
      slot.row.appendChild(wrap);
    }
  } else if (wrap.parentElement !== slot.row || wrap.nextElementSibling !== slot.before) {
    slot.row.insertBefore(wrap, slot.before);
  }
  const label = btn.getAttribute('aria-label');
  if (label) btn.title = label;
}

/** Header slot (before Grok / caret) of a whole tweet article, for article translation. */
export function findArticleHeaderSlot(tweetArticle) {
  return findHeaderActionsSlot(tweetArticle);
}

export function placeTranslateButton(postEl, btn) {
  const slot = findHeaderActionsSlot(postEl);
  if (slot) {
    mountHeaderButton(slot, btn, Boolean(getQuoteCard(postEl)));
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
