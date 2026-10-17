import { UI_ATTR } from '../../core/constants.js';
import { getLocale } from '../../i18n/index.js';
import { escapeHtml } from '../../utils/html.js';
import { normalizeLangCode } from '../../utils/lists.js';
import { restoreLinkedHtml } from '../../utils/linked-text.js';
import { icon } from '../../ui/icons.js';
import { fmt } from '../../utils/format.js';
import { ATTR, isReplaceMode, replaceRevealMode, tr } from './config.js';
import { languageDisplayName } from './lang.js';
import { TARGET_LANGUAGES } from './languages.js';
import { ensureToolbar, getToolbar } from './placement.js';

/**
 * Rendering of a finished translation: the separate result panel, or the
 * in-place replacement (button / hover-peek / split reveal modes).
 */

const TEXT_STATE_CLASSES = [
  'xp-text--translated',
  'xp-text--split',
  'xp-text--peeking',
  'xp-text--hover-peek',
  'xp-text--translating',
  'xp-text--blur-ready',
  'xp-text--reveal',
  'xp-text--swap',
];

/** Play a one-shot CSS animation class on `node` (restarts if already running). */
function playAnimation(node, className) {
  node.classList.remove('xp-text--reveal', 'xp-text--swap');
  void node.offsetWidth;
  node.classList.add(className);
  const done = (event) => {
    if (event.target !== node) return;
    node.classList.remove(className);
    node.removeEventListener('animationend', done);
  };
  node.addEventListener('animationend', done);
  setTimeout(() => {
    node.classList.remove(className);
    node.removeEventListener('animationend', done);
  }, 900);
}

/* ------------------------------------------------------------------ */
/* Toolbar visibility                                                  */
/* ------------------------------------------------------------------ */

export function syncToolbarVisibility(postEl) {
  const bar = getToolbar(postEl);
  if (!bar) return;
  const btnInBar = bar.querySelector(`[${ATTR.button}]`);
  const hasResult = Boolean(bar.querySelector(`[${ATTR.result}]`));
  const hideBar = Boolean(!btnInBar || btnInBar.hidden) && !hasResult;
  bar.classList.toggle('xp-toolbar--quiet', hideBar);
}

/* ------------------------------------------------------------------ */
/* Floating "detected language" badge (hover peek)                     */
/* ------------------------------------------------------------------ */

/** @type {WeakMap<HTMLElement, { badge: HTMLElement, onMove: () => void }>} */
const peekUiByPost = new WeakMap();

function resolveSourceLangRow(code) {
  const c = normalizeLangCode(code);
  if (!c) return null;
  return (
    TARGET_LANGUAGES.find((lang) => normalizeLangCode(lang.code) === c) ||
    TARGET_LANGUAGES.find((lang) => c.startsWith(`${normalizeLangCode(lang.code)}-`)) ||
    (c.startsWith('zh') ? TARGET_LANGUAGES.find((lang) => lang.code === 'zh-CN') : null) ||
    null
  );
}

function formatPeekLangLabel(code) {
  const row = resolveSourceLangRow(code);
  if (row) return `${row.flag} ${row.code}`;
  const name = languageDisplayName(code, getLocale());
  if (name) return name;
  const normalized = normalizeLangCode(code);
  return normalized ? normalized.toUpperCase() : '';
}

function syncFloatingPeekBadge(postEl) {
  const ui = peekUiByPost.get(postEl);
  if (!ui) return;
  const rect = postEl.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    ui.badge.hidden = true;
    return;
  }
  ui.badge.hidden = false;
  ui.badge.style.top = `${Math.max(4, rect.top - 6)}px`;
  ui.badge.style.left = `${rect.right}px`;
  ui.badge.style.transform = 'translate(-100%, -100%)';
}

function hideFloatingPeekBadge(postEl) {
  const ui = peekUiByPost.get(postEl);
  if (!ui) return;
  window.removeEventListener('scroll', ui.onMove, true);
  window.removeEventListener('resize', ui.onMove);
  ui.badge.remove();
  peekUiByPost.delete(postEl);
}

function showFloatingPeekBadge(postEl, code) {
  hideFloatingPeekBadge(postEl);
  const label = formatPeekLangLabel(code);
  if (!label) return;

  const badge = document.createElement('div');
  badge.className = 'xp-peek-badge';
  badge.setAttribute(UI_ATTR, '');
  badge.textContent = label;
  badge.title = fmt(tr('detectedLang'), { lang: label });
  badge.setAttribute('aria-hidden', 'true');
  document.body.appendChild(badge);

  const onMove = () => syncFloatingPeekBadge(postEl);
  peekUiByPost.set(postEl, { badge, onMove });
  syncFloatingPeekBadge(postEl);
  window.addEventListener('scroll', onMove, true);
  window.addEventListener('resize', onMove);
}

/* ------------------------------------------------------------------ */
/* In-place text                                                       */
/* ------------------------------------------------------------------ */

export function restoreOriginalText(postEl) {
  hideFloatingPeekBadge(postEl);
  const stored = postEl.getAttribute(ATTR.originalHtml);
  if (stored == null) return;
  postEl.innerHTML = stored;
  postEl.removeAttribute(ATTR.originalHtml);
  postEl.removeAttribute(ATTR.translatedHtml);
  postEl.removeAttribute(ATTR.sourceLang);
  postEl.classList.remove(...TEXT_STATE_CLASSES);
}

/** Blur the text while a translation is in flight. */
export function setTranslatingBlur(postEl, on) {
  if (on) {
    postEl.setAttribute('aria-busy', 'true');
    postEl.classList.add('xp-text--blur-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!postEl.isConnected) return;
        if (postEl.getAttribute('aria-busy') !== 'true') return;
        postEl.classList.add('xp-text--translating');
      });
    });
    return;
  }
  postEl.classList.remove('xp-text--translating', 'xp-text--blur-ready');
  postEl.removeAttribute('aria-busy');
}

function bindReplaceHover(postEl) {
  if (postEl.getAttribute(ATTR.peekBound) === '1') return;
  postEl.setAttribute(ATTR.peekBound, '1');

  postEl.addEventListener('mouseenter', () => {
    if (!isReplaceMode() || replaceRevealMode() !== 'hover') return;
    if (!postEl.classList.contains('xp-text--translated')) return;
    if (postEl.classList.contains('xp-text--split')) return;
    if (postEl.classList.contains('xp-text--translating')) return;
    const original = postEl.getAttribute(ATTR.originalHtml);
    if (original == null) return;
    postEl.innerHTML = original;
    postEl.classList.add('xp-text--peeking');
    playAnimation(postEl, 'xp-text--swap');
    const lang = postEl.getAttribute(ATTR.sourceLang);
    if (lang) showFloatingPeekBadge(postEl, lang);
  });

  postEl.addEventListener('mouseleave', () => {
    if (!postEl.classList.contains('xp-text--peeking')) return;
    hideFloatingPeekBadge(postEl);
    const translated = postEl.getAttribute(ATTR.translatedHtml);
    if (translated == null) {
      postEl.classList.remove('xp-text--peeking');
      return;
    }
    postEl.innerHTML = translated;
    postEl.classList.remove('xp-text--peeking');
    postEl.classList.add('xp-text--translated', 'xp-text--hover-peek');
    playAnimation(postEl, 'xp-text--swap');
  });
}

function paintTranslatedBody(postEl, translatedHtml) {
  const reveal = replaceRevealMode();
  const original = postEl.getAttribute(ATTR.originalHtml) || '';
  postEl.setAttribute(ATTR.translatedHtml, translatedHtml);
  postEl.classList.remove(...TEXT_STATE_CLASSES.filter((c) => c !== 'xp-text--translated'));
  postEl.removeAttribute('aria-busy');

  if (reveal === 'split') {
    postEl.innerHTML =
      `<div class="xp-split" data-xp-split="1">` +
      `<div class="xp-split__pane">` +
      `<div class="xp-split__label">${escapeHtml(tr('originalLabel'))}</div>` +
      `<div class="xp-split__body">${original}</div>` +
      `</div>` +
      `<div class="xp-split__pane xp-split__pane--translated">` +
      `<div class="xp-split__label">${escapeHtml(tr('translationLabel'))}</div>` +
      `<div class="xp-split__body">${translatedHtml}</div>` +
      `</div>` +
      `</div>`;
    postEl.classList.add('xp-text--translated', 'xp-text--split');
    playAnimation(postEl, 'xp-text--swap');
    return;
  }

  postEl.innerHTML = translatedHtml;
  postEl.classList.add('xp-text--translated');
  playAnimation(postEl, 'xp-text--reveal');
  if (reveal === 'hover') {
    postEl.classList.add('xp-text--hover-peek');
    bindReplaceHover(postEl);
  }
}

function applyReplacedText(postEl, translated, links = [], detected = null) {
  if (!postEl.hasAttribute(ATTR.originalHtml)) {
    postEl.setAttribute(ATTR.originalHtml, postEl.innerHTML);
  }
  const lang = normalizeLangCode(detected);
  if (lang) postEl.setAttribute(ATTR.sourceLang, lang);
  else postEl.removeAttribute(ATTR.sourceLang);
  paintTranslatedBody(postEl, restoreLinkedHtml(translated, links));
}

/* ------------------------------------------------------------------ */
/* Result panel                                                        */
/* ------------------------------------------------------------------ */

function ensureResult(postEl) {
  const bar = ensureToolbar(postEl);
  let box = bar.querySelector(`[${ATTR.result}]`);
  if (box) return box;
  box = document.createElement('div');
  box.className = 'xp-result';
  box.setAttribute(ATTR.result, '1');
  box.setAttribute(UI_ATTR, '');
  box.innerHTML = '<div class="xp-result__clip"><div class="xp-result__inner"></div></div>';
  bar.appendChild(box);
  return box;
}

function buildResultInnerHtml({ translated, detected, error, links }) {
  if (error) {
    return (
      `<div class="xp-result__error">${escapeHtml(error)}</div>` +
      `<button type="button" class="xp-btn xp-btn--retry" data-xp-retry="1">${icon('retry', 'xp-btn__icon')}<span class="xp-btn__label">${escapeHtml(tr('btnRetry'))}</span></button>`
    );
  }

  const meta = detected ? fmt(tr('detectedLang'), { lang: detected }) : '';
  const body = restoreLinkedHtml(translated, links || []);

  return (
    `<div class="xp-result__label">${escapeHtml(tr('translationLabel'))}</div>` +
    (meta ? `<div class="xp-result__meta">${escapeHtml(meta)}</div>` : '') +
    `<div class="xp-result__text">${body}</div>`
  );
}

export function hideResult(postEl, { remove = false } = {}) {
  const box = getToolbar(postEl)?.querySelector(`[${ATTR.result}]`);
  if (!box) return;

  const finish = () => {
    box.classList.remove('is-closing');
    if (remove) box.remove();
    else {
      const inner = box.querySelector('.xp-result__inner');
      if (inner) inner.innerHTML = '';
    }
  };

  if (!box.classList.contains('is-open')) {
    finish();
    return;
  }

  box.classList.remove('is-open');
  box.classList.add('is-closing');
  const onEnd = (event) => {
    if (event.target !== box.querySelector('.xp-result__clip')) return;
    box.removeEventListener('transitionend', onEnd);
    finish();
  };
  box.addEventListener('transitionend', onEnd);
  setTimeout(() => {
    box.removeEventListener('transitionend', onEnd);
    finish();
  }, 360);
}

/** Reveal a translation: separate panel, or replace the post text in place. */
export function showResult(postEl, payload) {
  const useReplace =
    isReplaceMode() && !payload.error && !payload.panelOnly && payload.translated != null;

  if (useReplace) {
    hideResult(postEl, { remove: true });
    applyReplacedText(postEl, payload.translated, payload.links || [], payload.detected);
    return null;
  }

  // Panel mode (and errors / notices in replace mode).
  restoreOriginalText(postEl);
  const box = ensureResult(postEl);
  const inner = box.querySelector('.xp-result__inner');
  if (!inner) return box;

  inner.innerHTML = buildResultInnerHtml(payload);
  box.classList.remove('is-open', 'is-closing');
  void box.offsetHeight;
  requestAnimationFrame(() => {
    box.classList.add('is-open');
  });
  return box;
}

/** Remove any rendered translation (panel and in-place) from a post. */
export function clearDisplay(postEl) {
  restoreOriginalText(postEl);
  hideResult(postEl, { remove: true });
}
