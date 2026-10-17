import { UI_ATTR } from '../../core/constants.js';
import { Codes, logWarn } from '../../core/debug.js';
import { getLocale, resolveTargetLang } from '../../i18n/index.js';
import { fmt } from '../../utils/format.js';
import { handleFromHref } from '../../utils/handle.js';
import {
  hasTranslatablePlainText,
  linkToken,
  restoreLinkedHtml,
} from '../../utils/linked-text.js';
import { isAutoTranslateAllowedForHandle } from './allowlist.js';
import { translateText } from './api.js';
import { setButtonLabel } from './button.js';
import { cfg, isAutoMode, isReplaceMode, replaceRevealMode, tr } from './config.js';
import { getLanguageSkipReason, isAccountBlocked } from './filters.js';

/**
 * X Articles (long-form posts) translated block by block.
 *
 * Two renderings of an article exist and both are supported:
 *   - signed-out web: Tailwind markup, body in `.x-article-body` (p / h3 / li …)
 *   - signed-in web:  draft-js, body in `twitterArticleRichTextView` (`data-block`)
 *
 * A toolbar with one Translate button is inserted above the body. Every block
 * (title included) is translated on its own — lines, links, bold / italic
 * lines and emoji survive — and shown the same way posts are: under the
 * original, or in place of it.
 */

const BODY_SELECTOR = '[data-testid="twitterArticleRichTextView"], .x-article-body';
const TITLE_SELECTOR = '[data-testid="twitter-article-title"], h1';
const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, li, blockquote, figcaption, [data-block="true"]';

const BAR_ATTR = 'data-xp-article-bar';
const ORIGINAL_ATTR = 'data-xp-art-original';
const TRANSLATED_ATTR = 'data-xp-art-translated';
/** Parallel block requests (public endpoints throttle bursts). */
const CONCURRENCY = 2;
/** Attempts per block; a throttled / flaky request is retried after a growing pause. */
const MAX_ATTEMPTS = 3;
/** Blocks shorter than this are poor language-detection samples. */
const DETECT_MIN_CHARS = 25;

/**
 * @typedef {object} Line
 * @property {string} text   - text with link placeholders
 * @property {number[]} ids  - link ids used by this line
 * @property {boolean} bold  - the whole line is bold
 * @property {boolean} italic
 *
 * @typedef {object} Extracted
 * @property {Line[]} lines
 * @property {object[]} links
 * @property {string} plain  - text without placeholders (language-detection sample)
 */

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

/** @returns {Extracted | null} */
function extractBlock(block) {
  const newLine = () => ({ text: '', ids: [], chars: 0, boldChars: 0, italicChars: 0 });
  const lines = [newLine()];
  const links = [];
  const current = () => lines[lines.length - 1];

  const add = (text, bold, italic) => {
    const line = current();
    line.text += text;
    const n = text.replace(/\s/g, '').length;
    line.chars += n;
    if (bold) line.boldChars += n;
    if (italic) line.italicChars += n;
  };

  const walk = (node, bold, italic) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        add(String(child.nodeValue).replace(/ /g, ' ').replace(/﻿/g, ''), bold, italic);
        continue;
      }
      if (child.nodeType !== 1 || child.hasAttribute(UI_ATTR)) continue;
      const tag = child.tagName;
      if (tag === 'STYLE' || tag === 'SCRIPT') continue;
      if (tag === 'BR') {
        lines.push(newLine());
        continue;
      }
      if (tag === 'IMG') {
        const alt = String(child.getAttribute('alt') || '').trim();
        if (alt) add(alt, bold, italic);
        continue;
      }
      if (tag === 'A' && child.hasAttribute('href')) {
        const id = links.length;
        const label = String(child.textContent || '').replace(/ /g, ' ').trim();
        links.push({
          href: child.getAttribute('href') || '',
          text: label,
          target: child.getAttribute('target') || '',
          rel: child.getAttribute('rel') || '',
        });
        current().ids.push(id);
        add(linkToken(id), bold, italic);
        current().chars += Math.max(0, label.length - 1);
        if (bold) current().boldChars += Math.max(0, label.length - 1);
        if (italic) current().italicChars += Math.max(0, label.length - 1);
        continue;
      }
      walk(child, bold || tag === 'B' || tag === 'STRONG', italic || tag === 'I' || tag === 'EM');
    }
  };
  walk(block, false, false);

  const kept = lines
    .map((line) => ({ ...line, text: line.text.replace(/[ \t]+/g, ' ').trim() }))
    .filter((line) => hasTranslatablePlainText(line.text));
  if (!kept.length) return null;

  const result = kept.map((line) => ({
    text: line.text,
    ids: line.ids,
    bold: line.chars > 0 && line.boldChars >= line.chars,
    italic: line.chars > 0 && line.italicChars >= line.chars,
  }));
  const plain = result
    .map((line) => line.text.replace(/\s*\d+\s*/g, ''))
    .join(' ')
    .trim();
  return { lines: result, links, plain };
}

function renderTranslation(extracted, translated) {
  const { lines, links } = extracted;
  const parts = String(translated).split(/\r?\n/).map((part) => part.trim());
  if (parts.length !== lines.length) {
    // Line structure was lost in translation: render as plain multi-line text.
    return restoreLinkedHtml(translated, links, { multiline: true });
  }
  return lines
    .map((line, i) => {
      let html = restoreLinkedHtml(parts[i], links, { multiline: false, only: line.ids });
      if (line.italic) html = `<em>${html}</em>`;
      if (line.bold) html = `<strong style="font-weight:700">${html}</strong>`;
      return html;
    })
    .join('<br>');
}

/* ------------------------------------------------------------------ */
/* DOM lookup                                                          */
/* ------------------------------------------------------------------ */

/** The article's title element (outside the body, inside a nearby ancestor). */
function findTitle(root) {
  let scope = root;
  for (let depth = 0; depth < 6; depth += 1) {
    scope = scope.parentElement;
    if (!scope) return null;
    for (const candidate of scope.querySelectorAll(TITLE_SELECTOR)) {
      if (!root.contains(candidate) && !candidate.closest('article, [data-xp-ui]')) {
        return candidate;
      }
    }
  }
  return null;
}

/** Translatable leaf blocks of the article, title first. */
function collectBlocks(root) {
  const blocks = [];
  const title = findTitle(root);
  if (title) blocks.push(title);

  root.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
    if (block.closest(`[${UI_ATTR}]`)) return;
    // Embedded posts / cards inside the article are not article text.
    const embedded = block.closest('article');
    if (embedded && root.contains(embedded)) return;
    if (block.querySelector(BLOCK_SELECTOR)) return; // not a leaf
    blocks.push(block);
  });
  return blocks;
}

function articleHandle() {
  return handleFromHref(location.pathname) || null;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} ArticleState
 * @property {HTMLElement} root
 * @property {HTMLElement} bar
 * @property {HTMLButtonElement} button
 * @property {HTMLElement} status
 * @property {number} runId
 * @property {Array<{ el: Element, box: Element | null }>} painted
 */

/** @type {Map<Element, ArticleState>} */
const states = new Map();
/** @type {IntersectionObserver | null} */
let autoObserver = null;

/** Button states. The article button is never hidden (unlike the per-post one). */
function setIdle(state) {
  state.button.dataset.xpState = '';
  state.button.hidden = false;
  setButtonLabel(state.button, tr('btnTranslate'));
}

function setShown(state) {
  const swapped = isReplaceMode() && replaceRevealMode() !== 'split';
  state.button.dataset.xpState = 'shown';
  state.button.hidden = false;
  setButtonLabel(state.button, swapped ? tr('btnShowOriginal') : tr('btnHide'), {
    glyph: swapped ? 'original' : 'hide',
  });
}

function setStatus(state, text, error = false) {
  state.status.textContent = text || '';
  state.status.hidden = !text;
  state.status.classList.toggle('is-error', error);
}

/* ------------------------------------------------------------------ */
/* Painting                                                            */
/* ------------------------------------------------------------------ */

function bindPeek(block) {
  if (block.dataset.xpPeekBound === '1') return;
  block.dataset.xpPeekBound = '1';
  block.addEventListener('mouseenter', () => {
    const original = block.getAttribute(ORIGINAL_ATTR);
    if (original == null || !block.hasAttribute(TRANSLATED_ATTR)) return;
    block.innerHTML = original;
    block.classList.add('xp-article-peek');
  });
  block.addEventListener('mouseleave', () => {
    const translated = block.getAttribute(TRANSLATED_ATTR);
    if (translated == null || !block.classList.contains('xp-article-peek')) return;
    block.innerHTML = translated;
    block.classList.remove('xp-article-peek');
  });
}

function paint(state, block, html) {
  if (isReplaceMode() && replaceRevealMode() !== 'split') {
    if (!block.hasAttribute(ORIGINAL_ATTR)) block.setAttribute(ORIGINAL_ATTR, block.innerHTML);
    block.setAttribute(TRANSLATED_ATTR, html);
    block.innerHTML = html;
    if (replaceRevealMode() === 'hover') bindPeek(block);
    state.painted.push({ el: block, box: null });
    return;
  }
  // Panel (and split) mode: the translation sits under the original block.
  const box = document.createElement('div');
  box.className = 'xp-article-tr';
  box.setAttribute(UI_ATTR, '');
  box.innerHTML = html;
  if (block.tagName === 'LI') block.appendChild(box);
  else block.insertAdjacentElement('afterend', box);
  state.painted.push({ el: block, box });
}

function clearPainted(state) {
  for (const { el: block, box } of state.painted) {
    box?.remove();
    const original = block.getAttribute(ORIGINAL_ATTR);
    if (original != null) {
      block.innerHTML = original;
      block.removeAttribute(ORIGINAL_ATTR);
      block.removeAttribute(TRANSLATED_ATTR);
      block.classList.remove('xp-article-peek');
    }
  }
  state.painted = [];
}

/* ------------------------------------------------------------------ */
/* Translation run                                                     */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateBlock(extracted, targetLang) {
  const text = extracted.lines.map((line) => line.text).join('\n');
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await translateText(text, targetLang);
      return { result, html: renderTranslation(extracted, result.text) };
    } catch (error) {
      // A missing API key will not fix itself; anything else may be throttling.
      if (error?.message === 'missing-config' || attempt >= MAX_ATTEMPTS) throw error;
      await sleep(700 * attempt * attempt);
    }
  }
}

async function pool(items, limit, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
}

async function run(state) {
  const runId = (state.runId += 1);
  const alive = () => state.runId === runId && state.root.isConnected;

  const blocks = collectBlocks(state.root)
    .map((el) => ({ el, extracted: extractBlock(el) }))
    .filter((block) => block.extracted);
  if (!blocks.length) return;

  const targetLang = resolveTargetLang(cfg().targetLang, getLocale());
  const total = blocks.length;
  let done = 0;
  let failed = 0;
  let missingConfig = false;

  const progress = () =>
    setButtonLabel(state.button, fmt(tr('articleProgress'), { done, total }), { loading: true });
  setStatus(state, '');
  progress();
  state.painted = [];

  // The first block doubles as the language-detection sample.
  const sample = Math.max(
    0,
    blocks.findIndex((block) => block.extracted.plain.length >= DETECT_MIN_CHARS),
  );
  const order = [sample, ...blocks.map((_, i) => i).filter((i) => i !== sample)];

  const handle = async (index) => {
    const { el: block, extracted } = blocks[index];
    try {
      const { result, html } = await translateBlock(extracted, targetLang);
      if (!alive()) return null;
      done += 1;
      progress();
      return { block, result, html };
    } catch (error) {
      if (!alive()) return null;
      failed += 1;
      done += 1;
      if (error?.message === 'missing-config') missingConfig = true;
      else logWarn(Codes.TRANSLATE_FAILED, 'article block translation failed', { error });
      progress();
      return null;
    }
  };

  const first = await handle(order[0]);
  if (!alive()) return;

  if (first) {
    const detected = first.result.detectedSourceLang;
    const skip = getLanguageSkipReason(detected);
    if (skip) {
      setStatus(state, skip === 'blocked' ? tr('langSkippedBlocked') : tr('langSkippedNotAllowed'));
      setIdle(state);
      return;
    }
    if (
      detected &&
      detected.toLowerCase() === targetLang.toLowerCase() &&
      blocks[order[0]].extracted.plain.trim() === first.result.text.trim()
    ) {
      setStatus(state, tr('articleSame'));
      setIdle(state);
      return;
    }
    paint(state, first.block, first.html);
  } else if (missingConfig) {
    setStatus(state, tr('errProviderConfig'), true);
    setIdle(state);
    return;
  }

  await pool(order.slice(1), CONCURRENCY, async (index) => {
    if (!alive()) return;
    const outcome = await handle(index);
    if (outcome && alive()) paint(state, outcome.block, outcome.html);
  });
  if (!alive()) return;

  if (failed === total) {
    setStatus(state, missingConfig ? tr('errProviderConfig') : tr('errNetwork'), true);
    setIdle(state);
    return;
  }
  if (failed) setStatus(state, tr('errNetwork'), true);
  setShown(state);
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function onToggle(state) {
  const { button } = state;
  if (button.classList.contains('is-loading')) return;
  if (button.dataset.xpState === 'shown') {
    state.runId += 1;
    clearPainted(state);
    setStatus(state, '');
    setIdle(state);
    return;
  }
  run(state);
}

function createBar(root) {
  const bar = document.createElement('div');
  bar.className = 'xp-article-bar';
  bar.setAttribute(BAR_ATTR, '1');
  bar.setAttribute(UI_ATTR, '');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xp-btn xp-article-bar__btn';
  button.setAttribute(UI_ATTR, '');
  const status = document.createElement('span');
  status.className = 'xp-article-bar__status';
  status.setAttribute(UI_ATTR, '');
  status.hidden = true;
  bar.append(button, status);

  /** @type {ArticleState} */
  const state = { root, bar, button, status, runId: 0, painted: [] };
  setButtonLabel(button, tr('btnTranslate'));
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggle(state);
  });
  root.insertAdjacentElement('beforebegin', bar);
  states.set(root, state);
  return state;
}

function observeForAuto(state) {
  if (!isAutoMode() || !isAutoTranslateAllowedForHandle(articleHandle())) return;
  if (state.bar.dataset.xpAutoDone === '1') return;
  autoObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      autoObserver.unobserve(entry.target);
      const owner = [...states.values()].find((s) => s.bar === entry.target);
      if (!owner || owner.bar.dataset.xpAutoDone === '1') continue;
      owner.bar.dataset.xpAutoDone = '1';
      if (owner.button.dataset.xpState !== 'shown') run(owner);
    }
  });
  autoObserver.observe(state.bar);
}

function removeState(root) {
  const state = states.get(root);
  if (!state) return;
  state.runId += 1;
  clearPainted(state);
  autoObserver?.unobserve(state.bar);
  state.bar.remove();
  states.delete(root);
}

/** Remove every article control and any translation shown in articles. */
export function teardownArticles() {
  for (const root of [...states.keys()]) removeState(root);
}

/** Idempotent pass: add / refresh the toolbar of every article on the page. */
export function scanArticles() {
  const config = cfg();
  const handle = articleHandle();
  if (!config.enabled || !config.articles || (handle && isAccountBlocked(handle))) {
    teardownArticles();
    return;
  }

  const roots = new Set(document.querySelectorAll(BODY_SELECTOR));
  for (const root of [...states.keys()]) if (!roots.has(root) || !root.isConnected) removeState(root);

  for (const root of roots) {
    let state = states.get(root);
    if (!state) {
      if (!collectBlocks(root).some((block) => extractBlock(block))) continue;
      state = createBar(root);
    } else if (!state.bar.isConnected) {
      root.insertAdjacentElement('beforebegin', state.bar);
    }
    const { button } = state;
    if (!button.classList.contains('is-loading')) {
      if (button.dataset.xpState === 'shown') setShown(state);
      else setIdle(state);
    }
    observeForAuto(state);
  }
}
