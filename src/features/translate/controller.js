import { UI_ATTR } from '../../core/constants.js';
import { getLocale, resolveTargetLang } from '../../i18n/index.js';
import { silencePointerEvents } from '../../utils/dom.js';
import { hasTranslatablePlainText } from '../../utils/linked-text.js';
import { isAutoTranslateAllowedForHandle } from './allowlist.js';
import { translateText } from './api.js';
import { resolvePostAuthorHandle } from './author.js';
import {
  applyIdleButton,
  applyNoticeShownButton,
  applyShownButton,
  beginTranslateUi,
  isLoading,
  isShown,
  setButtonLabel,
} from './button.js';
import {
  ATTR,
  AUTO_TRANSLATE_MAX_INFLIGHT,
  cfg,
  isAutoMode,
  tr,
} from './config.js';
import {
  extractPostForTranslate,
  postHasTranslatableContent,
} from './content.js';
import {
  clearDisplay,
  setTranslatingBlur,
  showResult,
  syncToolbarVisibility,
} from './display.js';
import { getLanguageSkipReason, isAccountBlocked } from './filters.js';
import { shouldSkipForNativeAutoTranslate } from './native.js';
import {
  findPostTextRoots,
  getToolbar,
  getTranslateButton,
  placeToolbar,
  placeTranslateButton,
  setToolbarBinder,
} from './placement.js';
import { Codes, logWarn } from '../../core/debug.js';

/**
 * Per-post orchestration: decide whether a post gets a Translate button,
 * handle clicks, run translations (manual or automatic while scrolling) and
 * keep everything consistent as X re-renders the feed.
 */

/** @type {IntersectionObserver | null} */
let visibilityObserver = null;
let autoInflight = 0;
/** @type {HTMLElement[]} */
const autoQueue = [];

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

/**
 * One delegated capture handler on the toolbar:
 *  - pointer events: stopPropagation only (so the post doesn't open)
 *  - click: handle Retry, then stopPropagation
 *
 * Do NOT use stopImmediatePropagation on the toolbar — it blocks the button handler.
 */
function bindToolbar(bar, postEl) {
  if (bar.dataset.xpBound === '1') return;
  bar.dataset.xpBound = '1';
  silencePointerEvents(bar);

  bar.addEventListener(
    'click',
    (event) => {
      event.stopPropagation();

      // Let translation-panel links navigate; only block post-open bubbling.
      const anchor = event.target.closest?.('a[href]');
      if (anchor && bar.contains(anchor)) return;

      event.preventDefault();

      const retry = event.target.closest?.('[data-xp-retry]');
      if (retry && bar.contains(retry)) {
        const translateBtn = getTranslateButton(postEl);
        if (translateBtn) {
          postEl.removeAttribute(ATTR.autoDone);
          runTranslate(postEl, translateBtn);
        }
      }
    },
    true,
  );
}

setToolbarBinder(bindToolbar);

function bindTranslateButton(btn, postEl) {
  if (btn.dataset.xpBound === '1') return;
  btn.dataset.xpBound = '1';
  silencePointerEvents(btn);

  btn.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTranslateClick(postEl, btn);
    },
    true,
  );
}

function ensureButton(postEl) {
  let btn = getTranslateButton(postEl);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xp-btn';
    btn.setAttribute(ATTR.button, '1');
    btn.setAttribute(UI_ATTR, '');
    setButtonLabel(btn, tr('btnTranslate'));
  }
  placeTranslateButton(postEl, btn);
  bindTranslateButton(btn, postEl);
  syncToolbarVisibility(postEl);
  return btn;
}

/* ------------------------------------------------------------------ */
/* Translate / toggle                                                  */
/* ------------------------------------------------------------------ */

async function runTranslate(postEl, btn) {
  const { text, links } = extractPostForTranslate(postEl);
  if (!hasTranslatablePlainText(text)) {
    setTranslatingBlur(postEl, false);
    teardownPostUi(postEl);
    return;
  }

  const targetLang = resolveTargetLang(cfg().targetLang, getLocale());
  clearDisplay(postEl);
  beginTranslateUi(postEl, btn);

  try {
    const result = await translateText(text, targetLang);
    setTranslatingBlur(postEl, false);
    const langSkip = getLanguageSkipReason(result.detectedSourceLang);
    if (langSkip) {
      showResult(postEl, {
        translated: langSkip === 'blocked' ? tr('langSkippedBlocked') : tr('langSkippedNotAllowed'),
        detected: result.detectedSourceLang,
        fromCache: result.fromCache,
        panelOnly: true,
      });
      applyNoticeShownButton(btn, postEl);
    } else if (
      result.detectedSourceLang &&
      result.detectedSourceLang.toLowerCase() === targetLang.toLowerCase() &&
      result.text.trim() === text.trim()
    ) {
      // Already in the target language — stay quiet, no panel.
      clearDisplay(postEl);
      applyIdleButton(btn, postEl);
    } else {
      showResult(postEl, {
        translated: result.text,
        detected: result.detectedSourceLang,
        fromCache: result.fromCache,
        links,
      });
      applyShownButton(btn, postEl);
    }
    postEl.setAttribute(ATTR.autoDone, '1');
  } catch (error) {
    setTranslatingBlur(postEl, false);
    if (error?.message !== 'missing-config') {
      logWarn(Codes.TRANSLATE_FAILED, 'translation failed', { error });
    }
    const message =
      error?.message === 'missing-config' ? tr('errProviderConfig') : tr('errNetwork');
    showResult(postEl, { error: message });
    applyIdleButton(btn, postEl);
    postEl.setAttribute(ATTR.autoDone, '1');
  }
}

function onTranslateClick(postEl, btn) {
  if (isLoading(btn)) return;
  if (isShown(btn)) {
    clearDisplay(postEl);
    applyIdleButton(btn, postEl);
    postEl.setAttribute(ATTR.autoDone, '1');
    return;
  }
  postEl.removeAttribute(ATTR.autoDone);
  runTranslate(postEl, btn);
}

/* ------------------------------------------------------------------ */
/* Automatic translation while scrolling                               */
/* ------------------------------------------------------------------ */

function shouldAutoTranslatePost(postEl) {
  if (!isAutoMode()) return false;
  if (shouldSkipForNativeAutoTranslate(postEl)) return false;
  const handle = resolvePostAuthorHandle(postEl);
  if (isAccountBlocked(handle)) return false;
  return isAutoTranslateAllowedForHandle(handle);
}

function stopAutoTranslate() {
  autoQueue.length = 0;
  autoInflight = 0;
  if (visibilityObserver) {
    visibilityObserver.disconnect();
    visibilityObserver = null;
  }
  document.querySelectorAll(`[${ATTR.observed}]`).forEach((el) => {
    el.removeAttribute(ATTR.observed);
  });
}

function pumpAutoQueue() {
  while (autoInflight < AUTO_TRANSLATE_MAX_INFLIGHT && autoQueue.length) {
    const postEl = autoQueue.shift();
    if (!postEl || !document.contains(postEl)) continue;
    postEl.removeAttribute(ATTR.autoQueued);
    if (!shouldAutoTranslatePost(postEl)) continue;
    if (postEl.getAttribute(ATTR.autoDone) === '1') continue;

    const btn = getTranslateButton(postEl);
    if (!btn || isLoading(btn) || isShown(btn)) {
      if (btn && isShown(btn)) postEl.setAttribute(ATTR.autoDone, '1');
      continue;
    }

    autoInflight += 1;
    Promise.resolve(runTranslate(postEl, btn))
      .catch(() => {})
      .finally(() => {
        autoInflight = Math.max(0, autoInflight - 1);
        pumpAutoQueue();
      });
  }
}

function enqueueAutoTranslate(postEl) {
  if (!shouldAutoTranslatePost(postEl)) return;
  if (postEl.getAttribute(ATTR.autoDone) === '1') return;
  if (postEl.getAttribute(ATTR.autoQueued) === '1') return;
  const btn = getTranslateButton(postEl);
  if (!btn || isLoading(btn) || isShown(btn)) {
    if (btn && isShown(btn)) postEl.setAttribute(ATTR.autoDone, '1');
    return;
  }
  postEl.setAttribute(ATTR.autoQueued, '1');
  autoQueue.push(postEl);
  pumpAutoQueue();
}

function ensureVisibilityObserver() {
  if (visibilityObserver) return visibilityObserver;
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (!isAutoMode()) return;
      for (const entry of entries) {
        // Any visible pixel is enough.
        if (!entry.isIntersecting) continue;
        if (!(entry.target instanceof HTMLElement)) continue;
        enqueueAutoTranslate(entry.target);
      }
    },
    { root: null, rootMargin: '0px', threshold: 0 },
  );
  return visibilityObserver;
}

function observeForAuto(postEl) {
  if (!shouldAutoTranslatePost(postEl)) return;
  const observer = ensureVisibilityObserver();
  if (postEl.getAttribute(ATTR.observed) === '1') return;
  postEl.setAttribute(ATTR.observed, '1');
  observer.observe(postEl);
}

/* ------------------------------------------------------------------ */
/* Per-post lifecycle                                                  */
/* ------------------------------------------------------------------ */

function teardownPostUi(el) {
  clearDisplay(el);
  const btn = getTranslateButton(el);
  const headerWrap = btn?.closest?.('.xp-header-action');
  getToolbar(el)?.remove();
  if (headerWrap) headerWrap.remove();
  else if (btn?.getAttribute?.('data-xp-header') === '1') btn.remove();
  el.removeAttribute(ATTR.post);
  el.removeAttribute(ATTR.observed);
  el.removeAttribute(ATTR.autoDone);
  el.removeAttribute(ATTR.autoQueued);
  try {
    visibilityObserver?.unobserve(el);
  } catch {
    /* ignore */
  }
}

function enhancePost(el) {
  const handle = resolvePostAuthorHandle(el);
  if (isAccountBlocked(handle) || shouldSkipForNativeAutoTranslate(el)) {
    teardownPostUi(el);
    return;
  }

  if (!postHasTranslatableContent(el)) {
    teardownPostUi(el);
    return;
  }

  if (el.hasAttribute(ATTR.post)) {
    // Re-place chrome if X re-rendered the tweet header / text tree.
    const bar = getToolbar(el);
    if (bar) {
      placeToolbar(el, bar);
      bindToolbar(bar, el);
    }
    const btn = getTranslateButton(el);
    if (btn) {
      placeTranslateButton(el, btn);
      bindTranslateButton(btn, el);
    } else {
      ensureButton(el);
    }
    observeForAuto(el);
    return;
  }

  el.setAttribute(ATTR.post, '1');
  ensureButton(el);
  observeForAuto(el);
}

/** Remove every piece of translate chrome (feature switched off). */
export function teardownAllPosts() {
  stopAutoTranslate();
  document.querySelectorAll(`[${ATTR.post}]`).forEach(teardownPostUi);
  document.querySelectorAll(`[${ATTR.toolbar}], .xp-header-action`).forEach((n) => n.remove());
}

/** Idempotent pass over the page; called after every scan and settings change. */
export function scanPosts() {
  if (!cfg().enabled) {
    teardownAllPosts();
    return;
  }
  if (!isAutoMode()) stopAutoTranslate();

  findPostTextRoots().forEach(enhancePost);

  // Re-queue visible allowlisted posts after settings / DOM rescans.
  if (isAutoMode()) {
    document.querySelectorAll(`[${ATTR.post}]`).forEach((el) => {
      if (shouldAutoTranslatePost(el)) enqueueAutoTranslate(el);
    });
  }

  // Re-label buttons (language / display mode may have changed).
  document.querySelectorAll(`[${ATTR.post}]`).forEach((postEl) => {
    const btn = getTranslateButton(postEl);
    if (!btn || isLoading(btn)) return;
    if (isShown(btn)) applyShownButton(btn, postEl);
    else applyIdleButton(btn, postEl);
  });
}
