import { emit } from '../../core/bus.js';
import { SEL, SHORTS_CELL_ATTR, SHORTS_FOCUS_ATTR, SHORTS_SETTLED_ATTR } from '../../core/constants.js';
import { isVerbose, logInfo } from '../../core/debug.js';
import { getFeatureSettings, updateFeatureSettings } from '../../core/settings.js';
import { isAutoPaused, runAutoplay, setAutoPaused, stopAutoplay } from './autoplay.js';
import { hideNav, pulseNav, syncNav } from './nav.js';

/**
 * Shorts mode: the feed moves one post at a time (wheel, ↑ / ↓, J / K). The
 * post nearest to the middle of the screen is `active` (slightly larger), the
 * previous / next ones are `prev` / `next`, the rest `far` (all blurred, each with
 * its own opacity) — styles in styles/shorts.css.
 *
 * Posts that X joins with a thread line (a reply under its post, a self-thread)
 * are one "post" here: they are marked, scaled, centred and stepped over together.
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

/** Avatar of a post's author; the thread line runs above / below it. */
const AVATAR_SELECTOR = '[data-testid="Tweet-User-Avatar"]';
/** The thread line is a thin vertical bar at most this wide (px)... */
const LINE_MAX_WIDTH = 6;
/** ...within this distance (px) of the avatar's vertical axis. */
const LINE_AXIS_SLACK = 30;
/** How long a cell's thread-line check is reused, in ms (+ jitter, so cells do not expire together). */
const LINES_TTL = 8000;
/** A cell where no line was found is checked again sooner (X may not have drawn it yet). */
const NO_LINES_TTL = 2000;
/** Thread lines are only looked for in cells within this many screens of the viewport. */
const LINES_RANGE = 1.5;
/** Scroll-driven re-marking runs at most this often, in ms. */
const UPDATE_EVERY_MS = 100;
/** The overlay check (selector scan + computed style) is reused this long, in ms. */
const OVERLAY_TTL = 200;
/** While scrolling to a post the target is re-measured every this many frames. */
const REMEASURE_FRAMES = 4;
/** After arriving, the post is re-centred once if the layout moved under it (images, buttons), after this long, in ms. */
const RECENTRE_AFTER_MS = 350;
/** Moves smaller than this (px) are not worth a correction. */
const RECENTRE_MIN = 6;

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

/**
 * One "post" of the mode: a single cell, or the cells of a thread.
 * @typedef {{ cell: Element, cells: Element[], tops: number[], rect: { top: number, bottom: number, height: number } }} Unit
 */

let active = false;
let frame = 0;
/** @type {{ id: number, until: number } | null} */
let tween = null;
/** First cell of the unit we are scrolling to; counts as active until the tween ends. */
let pinned = null;
let lastWheelAt = 0;
let lastWheelAbs = 0;
/** Whether the wheel gesture in progress is left to the browser (a post taller than the screen). */
let wheelNative = false;
let lastUpdateAt = 0;
let frameTimer = 0;
let recentreTimer = 0;
let recentreBudget = 0;
let lastInputAt = 0;
let overlayAt = 0;
let overlayOpenNow = false;
/** First cell of the unit whose settle timer runs / has run, that timer, and whether it fired. */
let settleTarget = null;
let settleTimer = 0;
let settleFired = false;
const linesCache = new WeakMap();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether the current page is a list of posts the mode makes sense on. */
export function isFeedPage() {
  return !NOT_A_FEED.test(location.pathname);
}

/** Only overlays that are on screen count: X keeps closed menus and dialogs in the DOM. */
function overlayOpen() {
  if (document.fullscreenElement) return true;
  const now = performance.now();
  if (now - overlayAt < OVERLAY_TTL) return overlayOpenNow;
  overlayAt = now;
  overlayOpenNow = false;
  for (const node of document.querySelectorAll(OVERLAY_SELECTOR)) {
    if (node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden') {
      overlayOpenNow = true;
      break;
    }
  }
  return overlayOpenNow;
}

/* ------------------------------------------------------------------ */
/* Posts                                                               */
/* ------------------------------------------------------------------ */

/**
 * Whether the post in `cell` continues a thread above it / goes on below it:
 * X draws that as a thin vertical line in the avatar column. Found by shape, not
 * by class, so a renamed atomic class does not break it: a thin empty bar in
 * the avatar column that ends at the avatar (line above) or starts from it (below).
 */
function threadLines(cell, rect) {
  const now = performance.now();
  const cached = linesCache.get(cell);
  if (cached && now < cached.until) return cached;

  const lines = { above: false, below: false, until: now + NO_LINES_TTL * (0.75 + Math.random() * 0.5) };
  // Far from the screen nothing is read (and nothing cached): it is checked once it comes near.
  const margin = window.innerHeight * LINES_RANGE;
  if (rect.bottom < -margin || rect.top > window.innerHeight + margin) return lines;
  linesCache.set(cell, lines);
  const article = cell.querySelector(SEL.article);
  const avatar = [...(article?.querySelectorAll(AVATAR_SELECTOR) ?? [])].find((node) => !node.closest(SEL.quoteTweet));
  const a = avatar?.getBoundingClientRect();
  if (!a?.width) return lines;
  const axis = a.left + a.width / 2;

  // The avatar column: the avatar's ancestor just below the place where the
  // post's text column joins it. It holds the avatar and nothing but the
  // thread lines, so any thin empty bar in it is one.
  let column = avatar;
  while (column.parentElement && column.parentElement !== article && !column.parentElement.querySelector(SEL.userName)) {
    column = column.parentElement;
  }
  const seen = verbose() ? [] : null;
  for (const node of column.querySelectorAll('div')) {
    if (node.childElementCount || avatar.contains(node) || node.contains(avatar)) continue;
    const r = node.getBoundingClientRect();
    if (r.width <= 0 || r.width > LINE_MAX_WIDTH || r.height < 2) continue;
    if (Math.abs(r.left + r.width / 2 - axis) > LINE_AXIS_SLACK) continue;
    seen?.push({ top: Math.round(r.top - a.top), bottom: Math.round(r.bottom - a.bottom), width: r.width });
    if (r.bottom <= a.top + 6) lines.above = true;
    else if (r.top >= a.bottom - 6) lines.below = true;
  }
  if (lines.above || lines.below) lines.until = now + LINES_TTL * (0.75 + Math.random() * 0.5);
  if (seen) logInfo('shorts', 'thread lines', { above: lines.above, below: lines.below, bars: seen, column: column.className });
  return lines;
}

function verbose() {
  return isVerbose();
}

/**
 * Whether `lower` continues the thread of `upper`: they are neighbours (no other
 * cell between) and the thread line runs out of one or into the other. One
 * of the two is enough, so a line that is drawn differently does not break it.
 */
function linked(upper, lower) {
  if (lower.index !== upper.index + 1) return false;
  return threadLines(upper.cell, upper.rect).below || threadLines(lower.cell, lower.rect).above;
}

/** Posts of the timeline, top to bottom; threads merged into one unit. @returns {Unit[]} */
function collect() {
  const column = document.querySelector(SEL.primaryColumn);
  if (!column) return [];
  // Every cell that takes room, so two posts with something else between them
  // ("show more replies", a suggestion) are not mistaken for neighbours.
  const boxes = [];
  for (const cell of column.querySelectorAll(SEL.cell)) {
    // Hidden posts (clean-up rules, collapsed or not yet laid out) have no box
    // to centre on; as a target they would send the scroll anywhere.
    const rect = cell.getBoundingClientRect();
    if (!rect.height) continue;
    boxes.push({ cell, rect, post: Boolean(cell.querySelector(SEL.article)) });
  }
  boxes.sort((a, b) => a.rect.top - b.rect.top);
  const singles = [];
  boxes.forEach((box, index) => {
    if (box.post) singles.push({ cell: box.cell, rect: box.rect, index });
  });

  /** @type {Unit[]} */
  const units = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const top = run[0].rect.top;
    const bottom = run[run.length - 1].rect.bottom;
    units.push({
      cell: run[0].cell,
      cells: run.map((entry) => entry.cell),
      tops: run.map((entry) => entry.rect.top),
      rect: { top, bottom, height: bottom - top },
    });
    run = [];
  };
  for (const entry of singles) {
    if (run.length && !linked(run[run.length - 1], entry)) flush();
    run.push(entry);
  }
  flush();
  return units;
}

/** Distance from the middle of the screen; 0 while the post covers it. */
function distanceToMiddle(rect) {
  const middle = window.innerHeight / 2;
  if (rect.top <= middle && rect.bottom >= middle) return 0;
  return Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
}

/** @param {Unit[]} units */
function pickActive(units) {
  if (pinned) {
    const unit = units.find((candidate) => candidate.cell === pinned);
    if (unit) return unit;
  }
  let best = null;
  let bestDistance = Infinity;
  for (const unit of units) {
    const distance = distanceToMiddle(unit.rect);
    if (distance < bestDistance) {
      best = unit;
      bestDistance = distance;
    }
  }
  return best;
}

function clearSettled() {
  clearTimeout(settleTimer);
  settleTimer = 0;
  settleTarget = null;
  settleFired = false;
  for (const cell of document.querySelectorAll(`[${SHORTS_SETTLED_ATTR}]`)) cell.removeAttribute(SHORTS_SETTLED_ATTR);
}

/** Mark the cells (once each) and tell the other features. */
function settleCells(cells) {
  for (const cell of cells) {
    if (!cell.isConnected || cell.hasAttribute(SHORTS_SETTLED_ATTR)) continue;
    cell.setAttribute(SHORTS_SETTLED_ATTR, '');
    emit('shorts:settled', cell);
  }
}

/**
 * Tell the other features which post is really being read: the current one,
 * after it has stayed current for SETTLE_MS (posts flown past cost nothing).
 * @param {Unit | null} unit
 */
function trackSettled(unit, enabled) {
  if (!enabled || !unit) {
    if (settleTarget) clearSettled();
    return;
  }
  if (unit.cell === settleTarget) {
    // A reply that loaded after the post settled joins it.
    if (settleFired) settleCells(unit.cells);
    return;
  }
  clearSettled();
  settleTarget = unit.cell;
  // Right away: whatever is already prepared for this post may show now.
  for (const cell of unit.cells) emit('shorts:active', cell);
  settleTimer = setTimeout(() => {
    settleTimer = 0;
    if (!active || settleTarget !== unit.cell) return;
    settleFired = true;
    // The thread may have grown meanwhile: take the current cells.
    const units = collect();
    const at = units.findIndex((candidate) => candidate.cell === unit.cell);
    settleCells(units[at]?.cells ?? unit.cells);
    // The post after it is the likely next stop: let others prepare it (nothing is shown).
    if (getFeatureSettings('shorts').translateNext) {
      for (const cell of units[at + 1]?.cells ?? []) emit('shorts:ahead', cell);
    }
  }, SETTLE_MS);
}

function update() {
  frame = 0;
  if (!active) return;
  lastUpdateAt = performance.now();
  const units = collect();
  const current = pickActive(units);
  const seen = new Set();
  const at = units.indexOf(current);
  units.forEach((unit, index) => {
    const state = index === at ? 'active' : index === at - 1 ? 'prev' : index === at + 1 ? 'next' : 'far';
    // The current thread grows from its own middle, so the joins between its posts stay put.
    const origin = (unit.rect.top + unit.rect.bottom) / 2;
    unit.cells.forEach((cell, i) => {
      seen.add(cell);
      if (cell.getAttribute(CELL_ATTR) !== state) cell.setAttribute(CELL_ATTR, state);
      if (state === 'active') {
        const offset = `${Math.round(origin - unit.tops[i])}px`;
        if (cell.style.getPropertyValue('--xp-shorts-oy') !== offset) cell.style.setProperty('--xp-shorts-oy', offset);
      }
    });
  });
  // X reuses cells: drop marks from the ones that stopped being posts.
  for (const cell of document.querySelectorAll(`[${CELL_ATTR}]`)) {
    if (!seen.has(cell)) cell.removeAttribute(CELL_ATTR);
  }
  const cfg = getFeatureSettings('shorts');
  trackSettled(current, cfg.translateOnlyCurrent);
  syncNav(
    {
      visible: Boolean(current) && cfg.buttons && !overlayOpen(),
      canPrev: at > 0 || window.scrollY > 4,
      canNext: true,
      auto: !cfg.autoplay ? 'off' : isAutoPaused() ? 'paused' : 'running',
    },
    NAV_ACTIONS,
  );
}

/**
 * Re-mark soon: on the next frame, but at most every UPDATE_EVERY_MS (scroll
 * events are far more frequent than the marks need). Not while we scroll
 * ourselves: the tween has marked the target already.
 */
function schedule() {
  if (frame || frameTimer || tween) return;
  const wait = UPDATE_EVERY_MS - (performance.now() - lastUpdateAt);
  if (wait > 0) {
    frameTimer = setTimeout(() => {
      frameTimer = 0;
      frame = requestAnimationFrame(update);
    }, wait);
  } else {
    frame = requestAnimationFrame(update);
  }
}

function clearMarks() {
  if (frame) cancelAnimationFrame(frame);
  clearTimeout(frameTimer);
  frame = 0;
  frameTimer = 0;
  for (const cell of document.querySelectorAll(`[${CELL_ATTR}]`)) {
    cell.removeAttribute(CELL_ATTR);
    cell.style.removeProperty('--xp-shorts-oy');
  }
}

/* ------------------------------------------------------------------ */
/* Scrolling                                                           */
/* ------------------------------------------------------------------ */

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Scroll offset that puts the cells in the middle (or at the top, when taller than the screen). */
function offsetFor(cells) {
  const view = window.innerHeight;
  let top = Infinity;
  let bottom = -Infinity;
  for (const cell of cells) {
    const rect = cell.getBoundingClientRect();
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  }
  const height = bottom - top;
  if (!(height > 0)) return null;
  const start = window.scrollY + top;
  const wanted = height > view - TALL_MARGIN * 2 ? start - TALL_MARGIN : start + height / 2 - view / 2;
  return clamp(Math.round(wanted), 0, maxScroll());
}

/** A tween that outlived its time (frames stopped, e.g. background tab) no longer blocks input. */
function animating() {
  return Boolean(tween) && performance.now() < tween.until;
}

function stopTween() {
  clearTimeout(recentreTimer);
  recentreTimer = 0;
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
    const now = target();
    if (now != null) jump(now);
    pinned = null;
    update();
    return;
  }
  let to = target();
  if (to == null) {
    pinned = null;
    return;
  }
  let frames = 0;
  const duration = clamp(340 + Math.abs(to - from) * 0.1, 360, 620) * factor;
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
    // The target is re-measured now and then (layout can shift while we go), not every frame.
    if (frames++ % REMEASURE_FRAMES === 0 || progress >= 1) {
      const measured = target();
      if (measured == null) {
        stopTween();
        update();
        return;
      }
      to = measured;
    }
    jump(from + (to - from) * eased);
    if (progress < 1) {
      state.id = requestAnimationFrame(step);
    } else {
      stopTween();
      update();
      if (cell) scheduleRecentre();
    }
  };
  state.id = requestAnimationFrame(step);
}

/**
 * X keeps changing a post's size after we arrive (images load, buttons appear),
 * and its cells are positioned absolutely, so nothing keeps the post centred.
 * Once, shortly after arriving, look again and ease the last bit if needed —
 * unless the user has already moved on.
 */
function scheduleRecentre() {
  if (recentreBudget <= 0) return;
  recentreBudget -= 1;
  clearTimeout(recentreTimer);
  const arrivedAt = performance.now();
  recentreTimer = setTimeout(() => {
    recentreTimer = 0;
    if (!active || tween || lastInputAt > arrivedAt) return;
    const current = pickActive(collect());
    if (!current) return;
    const want = offsetFor(current.cells);
    const off = want == null ? 0 : Math.abs(want - window.scrollY);
    if (off < RECENTRE_MIN || off > window.innerHeight * 0.5) return;
    animateTo(() => offsetFor(current.cells), current.cell);
  }, RECENTRE_AFTER_MS);
}

/** @param {Unit} unit */
function scrollToUnit(unit) {
  recentreBudget = 1;
  animateTo(() => offsetFor(unit.cells), unit.cell);
}

/** Move one post up (-1) or down (1). */
function go(direction) {
  pulseNav(direction);
  const units = collect();
  const current = pickActive(units);
  if (!current) return;
  const target = units[units.indexOf(current) + direction];
  if (target) {
    scrollToUnit(target);
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
  lastInputAt = performance.now();
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const direction = Math.sign(event.deltaY);
  if (!direction || !(event.target instanceof Element)) return;
  if (event.target.closest(CHROME_SELECTOR) || overlayOpen()) return;

  const now = performance.now();
  const strength = Math.abs(event.deltaY);
  // A new gesture starts after a pause or with a stronger push; the tail of a
  // trackpad flick only gets weaker.
  const fresh = now - lastWheelAt > GESTURE_GAP_MS || strength > lastWheelAbs + 4;
  lastWheelAt = now;
  lastWheelAbs = strength;

  // Events that only continue what is already decided cost no layout reads:
  // the tail of a gesture, and everything while we are scrolling.
  if (animating() || !fresh) {
    if (wheelNative && !animating()) return;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const current = pickActive(collect());
  if (!current) return;

  // A post (or thread) taller than the screen scrolls natively until its edge is in view.
  const { rect } = current;
  wheelNative =
    (direction > 0 && rect.bottom > window.innerHeight - EDGE_SLACK) || (direction < 0 && rect.top < EDGE_SLACK);
  if (wheelNative) return;

  event.preventDefault();
  event.stopPropagation();
  go(direction);
}

function onKeyDown(event) {
  if (!active || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  lastInputAt = performance.now();
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
  if (current) scrollToUnit(current);
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
  cells: () => [...document.querySelectorAll(`[${CELL_ATTR}="active"]`)],
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
