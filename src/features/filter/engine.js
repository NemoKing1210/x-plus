import { SEL, UI_ATTR } from '../../core/constants.js';
import { readPost } from './facts.js';
import { compileRules, postMatches } from './match.js';

/**
 * Applies the compiled filter to the page. Same model as interface/engine.js:
 * one MutationObserver, a dirty-article queue processed synchronously inside
 * the mutation callback (before paint) with a small time budget, and marks
 * taken back when a post stops matching or X recycles its cell.
 *
 * The whole timeline cell is hidden, so no empty frame stays behind. Nothing
 * is removed from the DOM: X's virtualization and scroll are untouched.
 */

const STYLE_ID = 'xp-filter-style';
const PEEK_STYLE_ID = 'xp-filter-peek-style';
const MARK_ATTR = 'data-xp-filtered';
const PEEK_ATTR = 'data-xp-peek';
/** Most time one callback may spend on posts before yielding to the next frame. */
const BUDGET_MS = 8;

const HIDE_CSS = `[${MARK_ATTR}]:not([${PEEK_ATTR}]){display:none!important}`;
const PEEK_CSS = `[${PEEK_ATTR}]{outline:2px solid var(--xp-accent,#1d9bf0)!important;outline-offset:-2px;border-radius:4px;box-shadow:0 0 0 6px rgba(29,155,240,.25)}
@media (prefers-reduced-motion:no-preference){[${PEEK_ATTR}]{transition:box-shadow .15s ease}}`;

/** @type {ReturnType<typeof compileRules>} */
let rules = [];
let observer = null;
const dirty = new Set();
let frame = 0;
/** article → the cell we marked, so a stale mark can be taken back. */
let marked = new WeakMap();

function ensureStyle(id) {
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    (document.head || document.documentElement).appendChild(style);
  }
  return style;
}

function clearMarks() {
  for (const node of document.querySelectorAll(`[${MARK_ATTR}]`)) {
    node.removeAttribute(MARK_ATTR);
  }
  marked = new WeakMap();
}

/** Recompute one post; X reuses cells, so a mark that no longer applies is removed. */
function process(article) {
  if (!article.isConnected) return;
  const cell = article.closest(SEL.cell) || article;
  const facts = readPost(article);
  const hit = facts ? postMatches(rules, facts) : false;
  const previous = marked.get(article);
  if (previous) previous.removeAttribute(MARK_ATTR);
  if (hit) {
    cell.setAttribute(MARK_ATTR, '');
    marked.set(article, cell);
  } else {
    cell.removeAttribute(MARK_ATTR);
    marked.delete(article);
  }
}

/** Process queued posts; whatever does not fit the budget moves to the next frame. */
function flush() {
  frame = 0;
  const started = performance.now();
  for (const article of dirty) {
    dirty.delete(article);
    process(article);
    if (performance.now() - started > BUDGET_MS) break;
  }
  if (dirty.size) frame = requestAnimationFrame(flush);
}

function onMutations(records) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const owner = node.closest?.(SEL.article);
      if (owner) {
        if (!owner.closest(`[${UI_ATTR}]`)) dirty.add(owner);
        continue;
      }
      for (const article of node.querySelectorAll?.(SEL.article) ?? []) {
        if (!article.closest(`[${UI_ATTR}]`)) dirty.add(article);
      }
    }
  }
  // Same task as the mutation, before paint: nothing flashes.
  if (dirty.size && !frame) flush();
}

function setObserving(on) {
  if (on && !observer) {
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else if (!on && observer) {
    observer.disconnect();
    observer = null;
    dirty.clear();
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }
}

/** Apply a settings section: compile, write CSS, watch (or stop) and re-check. */
export function sync(cfg) {
  rules = compileRules(cfg);
  if (!rules.length) {
    setObserving(false);
    clearMarks();
    ensureStyle(STYLE_ID).textContent = '';
    return;
  }
  ensureStyle(STYLE_ID).textContent = HIDE_CSS;
  setObserving(true);
  for (const article of document.querySelectorAll(SEL.article)) dirty.add(article);
  if (!frame) flush();
  sweep();
}

/** Navigation: drop marks from recycled cells and re-check what is on screen. */
export function sweep() {
  for (const cell of document.querySelectorAll(`[${MARK_ATTR}]`)) {
    if (!cell.querySelector(SEL.article)) cell.removeAttribute(MARK_ATTR);
  }
  for (const article of document.querySelectorAll(SEL.article)) dirty.add(article);
  if (!frame) flush();
}

/** Stop the preview: restore the hidden state and remove the outline style. */
export function clearPreview() {
  for (const node of document.querySelectorAll(`[${PEEK_ATTR}]`)) {
    node.removeAttribute(PEEK_ATTR);
  }
  document.getElementById(PEEK_STYLE_ID)?.remove();
}

const isOnScreen = (node) => {
  const rect = node.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
};

/**
 * Preview one draft rule on the page: matching cells are revealed (`data-xp-peek`
 * lifts the hide) and outlined. Returns how many matches are visible on screen.
 */
export function previewRule(rule) {
  clearPreview();
  const compiled = compileRules({ enabled: true, rules: [{ ...rule, enabled: true }] });
  let count = 0;
  for (const article of document.querySelectorAll(`${SEL.primaryColumn} ${SEL.article}`)) {
    const facts = readPost(article);
    if (!facts || !postMatches(compiled, facts)) continue;
    const cell = article.closest(SEL.cell) || article;
    cell.setAttribute(PEEK_ATTR, '');
    if (isOnScreen(cell)) count += 1;
  }
  if (count) ensureStyle(PEEK_STYLE_ID).textContent = PEEK_CSS;
  return count;
}
