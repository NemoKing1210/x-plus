import { emit } from '../../core/bus.js';
import { SEL, SHORTS_CELL_ATTR, SHORTS_FOCUS_ATTR, SHORTS_SETTLED_ATTR } from '../../core/constants.js';
import { getFeatureSettings, updateFeatureSettings } from '../../core/settings.js';
import { isAutoPaused, runAutoplay, setAutoPaused, stopAutoplay } from './autoplay.js';
import { hideNav, pulseNav, syncNav } from './nav.js';

/**
 * Shorts mode: the feed moves one post at a time (wheel, ↑ / ↓, J / K). The
 * post nearest to the middle of the screen is `active` (slightly larger), the
 * previous / next ones are `prev` / `next`, the rest `far` (all blurred, each with
 * its own opacity) — styles in styles/shorts.css.
 *
 * We never touch X's own layout: marks go on the timeline cells
 * (`data-xp-shorts`), the visual effect is applied to the article inside them
 * (X positions the cells themselves with transforms), and scrolling is a plain
 * `window.scrollTo` driven by our own tween, so X's virtualization and infinite
 * scroll keep working.
 */

const ROOT_ATTR = 'data-xp-shorts-on';
const CELL_ATTR = SHORTS_CELL_ATTR;
/** How long a post must stay current before it counts as read (and may be translated), in ms. */
const SETTLE_MS = 450;

/** Pages where posts are a conversation, not a feed. */
const NOT_A_FEED = /(?:^|\/)status\/|^\/(?:messages|settings|compose|i\/(?:grok|flow))(?:\/|$)/;
/** Anything modal on top of the page: wheel and keys belong to it. */
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"], .xp-gallery, .xp-popup, .xp-settings-backdrop, .xp-confirm-overlay';
/** Keys in these keep their meaning. */
const INTERACTIVE_SELECTOR =
  'input, textarea, select, video, audio, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="slider"]';
/** Left alone by the wheel: they scroll with the page on their own. */
const CHROME_SELECTOR = `${SEL.sidebar}, header[role="banner"]`;

/** Duration multiplier of the transitions (scroll and grow / blur) per `speed` setting. */
const SPEED = { slow: 1.7, normal: 1, fast: 0.55, instant: 0 };
/** Base length of the grow / blur transition, in seconds. */
const FADE_SECONDS = 0.5;

const KEY_STEP = { ArrowDown: 1, ArrowUp: -1, KeyJ: 1, KeyK: -1 };
/** Space keeps its meaning on controls: it presses the focused one. */
const PRESSABLE_SELECTOR =
  'button, a[href], summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"]';
/** Breathing room kept above / below a post that is taller than the screen. */
const TALL_MARGIN = 48;
/** A post whose edge is this close to the screen edge counts as fully seen. */
const EDGE_SLACK = 24;
/** Wheel events closer than this belong to one gesture (trackpad inertia). */
const GESTURE_GAP_MS = 120;

let active = false;
let frame = 0;
/** @type {{ id: number, until: number } | null} */
let tween = null;
/** Cell we are scrolling to; counts as active until the tween ends. */
let pinned = null;
let lastWheelAt = 0;
let lastWheelAbs = 0;
/** Cell whose settle timer runs / has run, and that timer. */
let settleTarget = null;
let settleTimer = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether the current page is a list of posts the mode makes sense on. */
export function isFeedPage() {
  return !NOT_A_FEED.test(location.pathname);
}

/** Only overlays that are on screen count: X keeps closed menus and dialogs in the DOM. */
function overlayOpen() {
  if (document.fullscreenElement) return true;
  for (const node of document.querySelectorAll(OVERLAY_SELECTOR)) {
    if (node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden') return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

/** Timeline cells holding a post, top to bottom, with their rects. */
function collect() {
  const column = document.querySelector(SEL.primaryColumn);
  if (!column) return [];
  const out = [];
  for (const cell of column.querySelectorAll(SEL.cell)) {
    if (!cell.querySelector(SEL.article)) continue;
    // Hidden posts (clean-up rules, collapsed or not yet laid out) have no box
    // to centre on; as a target they would send the scroll anywhere.
    const rect = cell.getBoundingClientRect();
    if (!rect.height) continue;
    out.push({ cell, rect });
  }
  return out.sort((a, b) => a.rect.top - b.rect.top);
}

/** Distance from the middle of the screen; 0 while the post covers it. */
function distanceToMiddle(rect) {
  const middle = window.innerHeight / 2;
  if (rect.top <= middle && rect.bottom >= middle) return 0;
  return Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
}

function pickActive(entries) {
  if (pinned) {
    const entry = entries.find((candidate) => candidate.cell === pinned);
    if (entry) return entry;
  }
  let best = null;
  let bestDistance = Infinity;
  for (const entry of entries) {
    const distance = distanceToMiddle(entry.rect);
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best;
}

function clearSettled() {
  clearTimeout(settleTimer);
  settleTimer = 0;
  settleTarget = null;
  for (const cell of document.querySelectorAll(`[${SHORTS_SETTLED_ATTR}]`)) cell.removeAttribute(SHORTS_SETTLED_ATTR);
}

/**
 * Tell the other features which post is really being read: the current one,
 * after it has stayed current for SETTLE_MS (posts flown past cost nothing).
 */
function trackSettled(cell, enabled) {
  if (!enabled || !cell) {
    if (settleTarget) clearSettled();
    return;
  }
  if (cell === settleTarget) return;
  clearSettled();
  settleTarget = cell;
  settleTimer = setTimeout(() => {
    settleTimer = 0;
    if (!active || settleTarget !== cell || !cell.isConnected) return;
    cell.setAttribute(SHORTS_SETTLED_ATTR, '');
    emit('shorts:settled', cell);
  }, SETTLE_MS);
}

function update() {
  frame = 0;
  if (!active) return;
  const entries = collect();
  const current = pickActive(entries);
  const seen = new Set();
  const at = entries.indexOf(current);
  entries.forEach(({ cell }, index) => {
    seen.add(cell);
    const state = index === at ? 'active' : index === at - 1 ? 'prev' : index === at + 1 ? 'next' : 'far';
    if (cell.getAttribute(CELL_ATTR) !== state) cell.setAttribute(CELL_ATTR, state);
  });
  // X reuses cells: drop marks from the ones that stopped being posts.
  for (const cell of document.querySelectorAll(`[${CELL_ATTR}]`)) {
    if (!seen.has(cell)) cell.removeAttribute(CELL_ATTR);
  }
  const cfg = getFeatureSettings('shorts');
  trackSettled(current?.cell ?? null, cfg.translateOnlyCurrent);
  syncNav(
    {
      visible: Boolean(current) && cfg.buttons && !overlayOpen(),
      canPrev: entries.indexOf(current) > 0 || window.scrollY > 4,
      canNext: true,
      auto: !cfg.autoplay ? 'off' : isAutoPaused() ? 'paused' : 'running',
    },
    NAV_ACTIONS,
  );
}

/** Re-mark on the next frame. Not while we scroll: the tween has marked the target already. */
function schedule() {
  if (!frame && !tween) frame = requestAnimationFrame(update);
}

function clearMarks() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  for (const cell of document.querySelectorAll(`[${CELL_ATTR}]`)) cell.removeAttribute(CELL_ATTR);
}

/* ------------------------------------------------------------------ */
/* Scrolling                                                           */
/* ------------------------------------------------------------------ */

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Scroll offset that puts `cell` in the middle (or at the top, when taller than the screen). */
function offsetFor(cell) {
  const rect = cell.getBoundingClientRect();
  const view = window.innerHeight;
  const top = window.scrollY + rect.top;
  const wanted = rect.height > view - TALL_MARGIN * 2 ? top - TALL_MARGIN : top + rect.height / 2 - view / 2;
  return clamp(Math.round(wanted), 0, maxScroll());
}

/** A tween that outlived its time (frames stopped, e.g. background tab) no longer blocks input. */
function animating() {
  return Boolean(tween) && performance.now() < tween.until;
}

function stopTween() {
  if (tween) cancelAnimationFrame(tween.id);
  tween = null;
  pinned = null;
}

/** Ease the window to `target()` (re-read every frame, so layout shifts do not derail it). */
function animateTo(target, cell = null) {
  stopTween();
  pinned = cell;
  const factor = SPEED[getFeatureSettings('shorts').speed] ?? 1;
  const from = window.scrollY;
  const jump = (top) => window.scrollTo({ top, left: 0, behavior: 'instant' });

  if (reducedMotion() || factor === 0) {
    jump(target());
    pinned = null;
    update();
    return;
  }
  const duration = clamp(340 + Math.abs(target() - from) * 0.1, 360, 620) * factor;
  const startedAt = performance.now();
  const state = { id: 0, until: startedAt + duration + 400 };
  tween = state;
  // Mark the target right away so the grow / blur transitions run together with the scroll.
  update();
  const step = (now) => {
    if (tween !== state) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    // Ease in and out: no abrupt start or stop.
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    if (cell && !cell.getBoundingClientRect().height) {
      stopTween();
      update();
      return;
    }
    const to = target();
    jump(from + (to - from) * eased);
    if (progress < 1) {
      state.id = requestAnimationFrame(step);
    } else {
      stopTween();
      update();
    }
  };
  state.id = requestAnimationFrame(step);
}

function scrollToCell(cell) {
  animateTo(() => offsetFor(cell), cell);
}

/** Move one post up (-1) or down (1). */
function go(direction) {
  pulseNav(direction);
  const entries = collect();
  const current = pickActive(entries);
  if (!current) return;
  const target = entries[entries.indexOf(current) + direction];
  if (target) {
    scrollToCell(target.cell);
    return;
  }
  // The neighbour is not in the DOM yet (X renders a window of the feed, and
  // loads more at the end): move a little in that direction so it gets
  // rendered, never to the start of the feed.
  const top = clamp(Math.round(window.scrollY + direction * window.innerHeight * 0.6), 0, maxScroll());
  if (top !== window.scrollY) animateTo(() => top);
}

/** Button handler: one step at a time, like the keys. */
function step(direction) {
  if (active && !animating()) go(direction);
}

/** Pause or resume the running auto-scroll. */
function togglePause() {
  setAutoPaused(!isAutoPaused());
  update();
}

/** The button: starts auto-scroll when it is off, otherwise pauses / resumes it. */
function toggleAuto() {
  if (getFeatureSettings('shorts').autoplay) togglePause();
  else updateFeatureSettings('shorts', { autoplay: true });
}

const NAV_ACTIONS = { step, toggleAuto };

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function onWheel(event) {
  if (!active || event.ctrlKey || event.defaultPrevented) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const direction = Math.sign(event.deltaY);
  if (!direction || !(event.target instanceof Element)) return;
  if (event.target.closest(CHROME_SELECTOR) || overlayOpen()) return;

  const entries = collect();
  const current = pickActive(entries);
  if (!current) return;

  const now = performance.now();
  const strength = Math.abs(event.deltaY);
  // A new gesture starts after a pause or with a stronger push; the tail of a
  // trackpad flick only gets weaker.
  const fresh = now - lastWheelAt > GESTURE_GAP_MS || strength > lastWheelAbs + 4;
  lastWheelAt = now;
  lastWheelAbs = strength;

  // A post taller than the screen scrolls natively until its edge is in view.
  const { rect } = current;
  if ((direction > 0 && rect.bottom > window.innerHeight - EDGE_SLACK) || (direction < 0 && rect.top < EDGE_SLACK)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (animating() || !fresh) return;
  go(direction);
}

function onKeyDown(event) {
  if (!active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const cfg = getFeatureSettings('shorts');

  // Pause / resume key of auto-scroll (a plain key, set in the settings).
  if (cfg.autoplay && cfg.autoKey && event.code === cfg.autoKey && !event.shiftKey) {
    const origin = event.target instanceof Element ? event.target : document.activeElement;
    if (origin?.closest?.(INTERACTIVE_SELECTOR) || overlayOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) {
      togglePause();
      pulseNav(0);
    }
    return;
  }

  if (!cfg.keys) return;
  const space = event.code === 'Space' || event.key === ' ';
  // Shift only turns Space around (as in the browser): Shift + Space goes back.
  if (event.shiftKey && !space) return;
  const direction = space ? (event.shiftKey ? -1 : 1) : (KEY_STEP[event.code] ?? KEY_STEP[event.key]);
  if (!direction) return;
  const target = event.target instanceof Element ? event.target : document.activeElement;
  if (target?.closest?.(INTERACTIVE_SELECTOR) || overlayOpen()) return;
  if (space && target?.closest?.(PRESSABLE_SELECTOR)) return;

  event.preventDefault();
  event.stopPropagation();
  if (!animating()) go(direction);
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function start() {
  active = true;
  document.documentElement.setAttribute(ROOT_ATTR, '');
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  // Settle on the post nearest to the middle right away.
  const current = pickActive(collect());
  if (current) scrollToCell(current.cell);
}

function stop() {
  active = false;
  stopTween();
  document.documentElement.removeAttribute(ROOT_ATTR);
  document.documentElement.removeAttribute(SHORTS_FOCUS_ATTR);
  window.removeEventListener('wheel', onWheel, true);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('scroll', schedule);
  window.removeEventListener('resize', schedule);
  clearMarks();
  clearSettled();
  stopAutoplay();
  hideNav();
}

const AUTOPLAY_API = {
  cell: () => document.querySelector(`[${CELL_ATTR}="active"]`),
  moving: animating,
  blocked: overlayOpen,
  step: () => step(1),
  toggle: togglePause,
};

/** Bring the mode in line with the settings and the current page. Idempotent. */
export function syncShorts() {
  const cfg = getFeatureSettings('shorts');
  const style = document.documentElement.style;
  style.setProperty('--xp-shorts-scale', String(cfg.scale / 100));
  style.setProperty('--xp-shorts-blur', `${cfg.blur}px`);
  style.setProperty('--xp-shorts-prev-opacity', String(cfg.prevOpacity / 100));
  style.setProperty('--xp-shorts-next-opacity', String(cfg.nextOpacity / 100));
  // Posts further away follow the fainter of the two neighbours.
  style.setProperty('--xp-shorts-far-opacity', String(Math.min(cfg.prevOpacity, cfg.nextOpacity) / 100));
  style.setProperty('--xp-shorts-time', `${FADE_SECONDS * (SPEED[cfg.speed] ?? 1)}s`);

  const wanted = cfg.enabled && isFeedPage();
  if (wanted && !active) start();
  else if (!wanted && active) stop();
  else if (active) schedule();

  document.documentElement.toggleAttribute(SHORTS_FOCUS_ATTR, active && cfg.translateOnlyCurrent);

  if (active && cfg.autoplay) runAutoplay(AUTOPLAY_API);
  else stopAutoplay();
}
