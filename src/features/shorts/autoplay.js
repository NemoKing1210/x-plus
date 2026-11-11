import { SEL, SHORTS_PAUSED_KEY } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { getValue, setValue } from '../../core/storage.js';
import { t } from '../../i18n/index.js';
import { icon } from '../../ui/icons.js';
import { el } from '../../utils/dom.js';
import { keyLabel } from '../../utils/keys.js';
import { navHovered, navVisible, setRing } from './nav.js';

/**
 * Auto-scroll: after `autoDelay` seconds on a post, step to the next one.
 *
 * The countdown restarts on every post (however it became the current one) and
 * stands still while the user paused it (button or hotkey), the pointer rests
 * on the controls, or a dialog is open; time that passes while frames are not
 * drawn (background tab) is not counted. The user's pause is runtime state, not
 * a setting, but it is persisted, so it survives leaving the feed (a post page)
 * and a reload; turning auto-scroll off and on again clears it. Progress is
 * shown as a ring around the "next" button, as a bar over the top edge of the
 * current post (with a small pause chip showing the hotkey), or both — see
 * `autoStyle`.
 *
 * A video longer than `autoDelay` keeps its post until it has actually played to
 * the end (not merely until its length has passed, so a late start, buffering
 * or a seek cannot make the jump early). The countdown follows the video:
 * pausing the video by hand freezes the countdown, and pausing the countdown
 * pauses the video; resuming brings both back.
 *
 * The engine hands in what only it knows (`api`), so there is no import cycle.
 *
 * @typedef {object} AutoplayApi
 * @property {() => Element[]} cells       cells of the current post (several for a thread)
 * @property {() => boolean} moving         a scroll animation is running
 * @property {() => boolean} blocked        a dialog / menu / fullscreen is open
 * @property {() => void} step              go to the next post
 * @property {() => void} toggle            pause / resume
 */

/** Longest frame counted, in ms. */
const MAX_FRAME_MS = 100;
/** A video longer than this does not hold the post any longer than this, in ms. */
const MAX_VIDEO_MS = 5 * 60 * 1000;
/** How long a video's length is waited for before the plain countdown takes over, in ms. */
const METADATA_GRACE_MS = 5000;
/** A video that never starts (broken, or the browser refused to play it) stops holding the post after this, in ms. */
const START_GRACE_MS = 10000;
/** How often the (costly) overlay check runs, in ms. */
const BLOCKED_CHECK_MS = 250;
/** How often the bar's position is re-measured, in ms. */
const BAR_MEASURE_MS = 250;
/** How often the active cells / their videos are re-queried, in ms. */
const CELLS_CACHE_MS = 250;
const VIDEO_CACHE_MS = 1000;
/** Progress is drawn in 1 % steps: smooth enough, and keeps per-frame DOM writes low. */
const PROGRESS_STEPS = 100;
/** Space between the chip and the top edge of the post. */
const CHIP_OFFSET = 30;

/** @type {AutoplayApi | null} */
let api = null;
let frame = 0;
let last = 0;
let elapsed = 0;
let current = null;
/** When the current post became current, in ms; the video graces are measured from here. */
let currentSince = 0;
/** Whether the previous frame saw the user's pause; a change pauses / resumes the video. */
let wasUserPaused = false;
/** Videos this countdown paused (not the user), so they are played again when it resumes. */
const pausedForTimer = new WeakSet();
let blocked = false;
let blockedAt = 0;
/** Paused by the user (button / hotkey); persisted so it outlives a page load. */
let userPaused = getValue(SHORTS_PAUSED_KEY, false) === true;
let bar = null;
let chip = null;
let chipOver = false;
/** Last drawn state of the bar / ring, and when the bar was last measured. */
let barShown = { progress: -1, paused: null };
let barRect = null;
let barMeasuredAt = 0;
let barCell = null;
let ringShown = { progress: -1, paused: null };
/** Cached cells / videos / bar geometry, so the rAF loop does not query the DOM every frame. */
let cellsCached = [];
let cellsCachedAt = 0;
let holdCached = { cell: null, at: 0, videos: [] };
let barBox = { left: null, top: null, width: null };
let chipBox = { left: null, top: null };

export function isAutoPaused() {
  return userPaused;
}

export function setAutoPaused(value) {
  const next = Boolean(value);
  if (next !== userPaused) setValue(SHORTS_PAUSED_KEY, next);
  userPaused = next;
}

/**
 * The video the post waits for: the longest one in the post that is neither a
 * looping clip (a GIF) nor a quoted post's video. `duration` is null while the
 * metadata has not loaded yet.
 * @returns {{ video: HTMLVideoElement, duration: number | null } | null}
 */
function holdingVideo(cells, now) {
  const key = cells[0] ?? null;
  if (holdCached.cell !== key || now - holdCached.at > VIDEO_CACHE_MS) {
    const videos = [];
    for (const cell of cells) {
      for (const video of cell.querySelectorAll('video')) videos.push(video);
    }
    holdCached = { cell: key, at: now, videos };
  }

  let best = null;
  for (const video of holdCached.videos) {
    if (!video.isConnected || video.loop || video.error || video.closest(SEL.quoteTweet)) continue;
    const finite = Number.isFinite(video.duration) && video.duration > 0;
    const duration = finite ? video.duration : null;
    if (!best || (duration ?? 0) > (best.duration ?? 0)) best = { video, duration };
  }
  return best;
}

/** Whether a video has played to its end (it may not be `ended` for a moment after the last frame). */
function videoEnded(video) {
  if (video.ended) return true;
  const duration = video.duration;
  return Number.isFinite(duration) && duration > 0 && video.currentTime >= duration - 0.05;
}

/** Where the countdown stands: progress 0..1, and whether the post has been held long enough. */
function holdProgress(hold, cfg, now) {
  const base = cfg.autoDelay * 1000;
  const baseProgress = Math.min(1, elapsed / base);
  const baseDone = elapsed >= base;
  if (!hold) return { progress: baseProgress, ready: baseDone };

  const { video, duration } = hold;
  const ended = videoEnded(video);
  // A video that never starts (broken, or refused by the browser) must not
  // hold the post forever: after the grace it counts as no video at all.
  if (!ended && video.currentTime === 0 && now - currentSince > START_GRACE_MS) {
    return { progress: baseProgress, ready: baseDone };
  }

  if (duration == null) {
    // The length is not known yet (the metadata is still loading): wait for it a
    // moment instead of jumping at the plain time, then fall back to it.
    const loose = Boolean(video.error) || now - currentSince > METADATA_GRACE_MS;
    return { progress: loose ? baseProgress : Math.min(baseProgress, 0.999), ready: baseDone && loose };
  }

  const videoMs = duration * 1000;
  if (videoMs > MAX_VIDEO_MS) {
    // Longer than we are willing to wait for: the post gets MAX_VIDEO_MS at most.
    const wait = Math.max(base, MAX_VIDEO_MS);
    return { progress: Math.min(1, elapsed / wait), ready: elapsed >= wait };
  }
  if (videoMs > base) {
    // Longer than the set time: follow the video itself, so a late start, a
    // stall or a seek cannot make the jump early.
    return { progress: Math.min(1, video.currentTime / duration), ready: baseDone && ended };
  }
  return { progress: baseProgress, ready: baseDone && ended };
}

/** Pause the video together with the countdown (not one the user had already paused). */
function pauseHoldVideo(video) {
  if (!video || video.paused || video.ended) return;
  pausedForTimer.add(video);
  video.pause();
}

/**
 * Play again a video the countdown stopped, or (when the user resumes the
 * countdown by hand) one they paused themselves.
 */
function resumeHoldVideo(video, force) {
  if (!video) return;
  const ours = pausedForTimer.has(video);
  pausedForTimer.delete(video);
  if (!video.paused || video.ended) return;
  if (ours || force) video.play().catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

function ensureBar() {
  if (bar) return bar;
  bar = el('div', 'xp-shorts-bar');
  bar.appendChild(el('div', 'xp-shorts-bar__fill'));
  (document.body || document.documentElement).appendChild(bar);
  return bar;
}

function ensureChip() {
  if (chip) return chip;
  chip = el('button', 'xp-shorts-chip');
  chip.type = 'button';
  chip.addEventListener('mousedown', (event) => event.preventDefault());
  chip.addEventListener('pointerenter', () => (chipOver = true));
  chip.addEventListener('pointerleave', () => (chipOver = false));
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    api?.toggle();
  });
  (document.body || document.documentElement).appendChild(chip);
  return chip;
}

/** Whether the pointer rests on the chip (tracked by events, see ensureChip). */
function chipHovered() {
  return chipOver;
}

/** Pause / resume chip with the hotkey, at the right end of the bar. */
function renderChip(rect, state, cfg) {
  const node = ensureChip();
  const key = keyLabel(cfg.autoKey);
  const signature = `${state.userPaused ? 'p' : 'r'}|${key}`;
  if (node.dataset.signature !== signature) {
    node.dataset.signature = signature;
    node.replaceChildren();
    node.insertAdjacentHTML('beforeend', icon(state.userPaused ? 'play' : 'pause'));
    if (key) node.appendChild(el('kbd', 'xp-shorts-chip__key', key));
    const label = t(state.userPaused ? 'shorts.autoResume' : 'shorts.autoPause');
    node.title = key ? `${label} (${key})` : label;
    node.setAttribute('aria-label', label);
  }
  const left = `${Math.round(rect.right - 8)}px`;
  const top = `${Math.max(4, Math.round(rect.top - CHIP_OFFSET))}px`;
  if (chipBox.left !== left) {
    node.style.left = left;
    chipBox.left = left;
  }
  if (chipBox.top !== top) {
    node.style.top = top;
    chipBox.top = top;
  }
  if (!node.classList.contains('is-on')) node.classList.add('is-on');
}

/** Where the post's top edge is: measured now and then (it sits still between steps), not every frame. */
function barGeometry(cell, now) {
  if (barCell !== cell || !barRect || now - barMeasuredAt > BAR_MEASURE_MS) {
    barCell = cell;
    barRect = cell.querySelector(SEL.article)?.getBoundingClientRect() ?? null;
    barMeasuredAt = now;
  }
  return barRect;
}

/** Bar over the top edge of the post (its own box: the post is scaled). */
function renderBar(state, cfg, now = performance.now()) {
  if (!state && !bar) return;
  const node = ensureBar();
  const rect = state ? barGeometry(state.cell, now) : null;
  const visible = Boolean(rect?.width);
  node.classList.toggle('is-on', visible);
  if (!visible) {
    chip?.classList.remove('is-on');
    barShown = { progress: -1, paused: null };
    barCell = null;
    return;
  }
  node.classList.toggle('is-paused', state.paused);
  const left = `${Math.round(rect.left)}px`;
  const top = `${Math.round(rect.top)}px`;
  const width = `${Math.round(rect.width)}px`;
  if (barBox.left !== left) {
    node.style.left = left;
    barBox.left = left;
  }
  if (barBox.top !== top) {
    node.style.top = top;
    barBox.top = top;
  }
  if (barBox.width !== width) {
    node.style.width = width;
    barBox.width = width;
  }
  const progress = Math.round(state.progress * PROGRESS_STEPS) / PROGRESS_STEPS;
  if (progress !== barShown.progress) node.style.setProperty('--xp-auto-progress', String(progress));
  barShown = { progress, paused: state.paused };
  renderChip(rect, state, cfg);
}

/**
 * @param {{ cell: Element, progress: number, paused: boolean, userPaused: boolean } | null} state
 * @param {object} cfg
 */
function render(state, cfg) {
  const buttons = navVisible();
  const style = cfg.autoStyle;
  const ring = buttons && (style === 'auto' || style === 'ring' || style === 'both');
  const showBar = style === 'bar' || style === 'both' || (style === 'auto' && !buttons);
  const progress = Math.round((state?.progress ?? 0) * PROGRESS_STEPS) / PROGRESS_STEPS;
  const paused = state?.paused ?? false;
  if (!ring) {
    setRing(null);
    ringShown = { progress: -1, paused: null };
  } else if (progress !== ringShown.progress || paused !== ringShown.paused) {
    setRing({ progress, paused });
    ringShown = { progress, paused };
  }
  renderBar(showBar ? state : null, cfg);
}

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

function tick(now) {
  frame = requestAnimationFrame(tick);
  const cfg = getFeatureSettings('shorts');
  const dt = Math.min(now - last, MAX_FRAME_MS);
  last = now;

  if (api.moving()) {
    elapsed = 0;
    current = null;
    currentSince = 0;
    cellsCached = [];
    render(null, cfg);
    return;
  }
  // The engine updates the active cell at ~10 Hz; re-querying every frame only
  // repeats the same DOM work. 250 ms keeps the countdown in step with it.
  if (!cellsCached.length || now - cellsCachedAt > CELLS_CACHE_MS) {
    cellsCached = api.cells();
    cellsCachedAt = now;
  }
  const cells = cellsCached;
  const cell = cells[0];
  if (!cell) {
    render(null, cfg);
    return;
  }
  if (cell !== current) {
    current = cell;
    currentSince = now;
    elapsed = 0;
  }
  if (now - blockedAt > BLOCKED_CHECK_MS) {
    blocked = api.blocked();
    blockedAt = now;
  }
  if (blocked) {
    render(null, cfg);
    return;
  }

  const videoHold = holdingVideo(cells, now);
  const video = videoHold?.video ?? null;
  const hold = cfg.autoWaitVideo ? videoHold : null;

  // The pause is shared, but only on an edge: pausing the countdown pauses the
  // video once, resuming plays it once. Re-applying `pause()` every frame also
  // re-paused a video the user had started by hand.
  if (userPaused) {
    if (!wasUserPaused) pauseHoldVideo(video);
  } else if (wasUserPaused) {
    resumeHoldVideo(video, true);
  } else if (video && pausedForTimer.has(video)) {
    resumeHoldVideo(video);
  }
  wasUserPaused = userPaused;

  const ended = Boolean(video) && videoEnded(video);
  const videoPaused =
    Boolean(video) &&
    video.paused &&
    !ended &&
    video.currentTime > 0 &&
    !pausedForTimer.has(video);
  const paused = userPaused || videoPaused || (cfg.autoHover && (navHovered() || chipHovered()));
  if (!paused) elapsed += dt;

  const state = holdProgress(hold, cfg, now);
  render({ cell, progress: state.progress, paused, userPaused }, cfg);
  if (state.ready) {
    // Restart in case the step goes nowhere (end of the loaded feed).
    elapsed = 0;
    api.step();
  }
}

/** Start (or keep) the countdown. Idempotent. */
export function runAutoplay(handlers) {
  api = handlers;
  if (frame) return;
  last = performance.now();
  elapsed = 0;
  current = null;
  currentSince = 0;
  blockedAt = 0;
  cellsCached = [];
  cellsCachedAt = 0;
  holdCached = { cell: null, at: 0, videos: [] };
  // The pause is deliberately kept: it comes from storage and the user asked
  // for it to survive leaving the feed and reloads. A pause restored from
  // storage does not reach for the video: only a pause made now pauses it.
  wasUserPaused = userPaused;
  frame = requestAnimationFrame(tick);
}

export function stopAutoplay() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  current = null;
  currentSince = 0;
  elapsed = 0;
  wasUserPaused = false;
  cellsCached = [];
  cellsCachedAt = 0;
  holdCached = { cell: null, at: 0, videos: [] };
  barBox = { left: null, top: null, width: null };
  chipBox = { left: null, top: null };
  // Never leave a video paused by the countdown. A WeakSet is not iterable, so
  // scan the videos that are still on the page.
  for (const video of document.querySelectorAll('video')) {
    if (pausedForTimer.has(video)) resumeHoldVideo(video);
  }
  setRing(null);
  ringShown = { progress: -1, paused: null };
  chipOver = false;
  renderBar(null, null);
}
