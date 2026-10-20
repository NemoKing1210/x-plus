import { SEL } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
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
 * drawn (background tab) is not counted. Progress is shown as a ring around the
 * "next" button, as a bar over the top edge of the current post (with a small
 * pause chip showing the hotkey), or both — see `autoStyle`.
 *
 * The engine hands in what only it knows (`api`), so there is no import cycle.
 *
 * @typedef {object} AutoplayApi
 * @property {() => Element | null} cell    current post cell
 * @property {() => boolean} moving         a scroll animation is running
 * @property {() => boolean} blocked        a dialog / menu / fullscreen is open
 * @property {() => void} step              go to the next post
 * @property {() => void} toggle            pause / resume
 */

/** Longest frame counted, in ms. */
const MAX_FRAME_MS = 100;
/** A video longer than this does not hold the post any longer. */
const MAX_VIDEO_MS = 5 * 60 * 1000;
/** How often the (costly) overlay check runs, in ms. */
const BLOCKED_CHECK_MS = 250;
/** Space between the chip and the top edge of the post. */
const CHIP_OFFSET = 30;

/** @type {AutoplayApi | null} */
let api = null;
let frame = 0;
let last = 0;
let elapsed = 0;
let current = null;
let blocked = false;
let blockedAt = 0;
/** Paused by the user (button / hotkey); lasts until resumed or auto-scroll restarts. */
let userPaused = false;
let bar = null;
let chip = null;

export function isAutoPaused() {
  return userPaused;
}

export function setAutoPaused(value) {
  userPaused = Boolean(value);
}

/** How long `cell` stays: the set time, or the video's length when it is longer. */
function durationFor(cell, cfg) {
  const base = cfg.autoDelay * 1000;
  if (!cfg.autoWaitVideo) return base;
  let longest = 0;
  for (const video of cell.querySelectorAll('video')) {
    if (video.loop || !Number.isFinite(video.duration)) continue;
    longest = Math.max(longest, video.duration * 1000);
  }
  return Math.max(base, Math.min(longest, MAX_VIDEO_MS));
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
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    api?.toggle();
  });
  (document.body || document.documentElement).appendChild(chip);
  return chip;
}

function chipHovered() {
  return Boolean(chip) && chip.classList.contains('is-on') && chip.matches(':hover');
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
  node.style.left = `${Math.round(rect.right - 8)}px`;
  node.style.top = `${Math.max(4, Math.round(rect.top - CHIP_OFFSET))}px`;
  node.classList.toggle('is-on', true);
}

/** Bar over the top edge of the post (its own box: the post is scaled). */
function renderBar(state, cfg) {
  if (!state && !bar) return;
  const node = ensureBar();
  const article = state?.cell.querySelector(SEL.article);
  const rect = article?.getBoundingClientRect();
  const visible = Boolean(rect?.width);
  node.classList.toggle('is-on', visible);
  if (!visible) {
    chip?.classList.remove('is-on');
    return;
  }
  node.classList.toggle('is-paused', state.paused);
  node.style.left = `${Math.round(rect.left)}px`;
  node.style.top = `${Math.round(rect.top)}px`;
  node.style.width = `${Math.round(rect.width)}px`;
  node.style.setProperty('--xp-auto-progress', String(state.progress));
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
  setRing(ring ? { progress: state?.progress ?? 0, paused: state?.paused ?? false } : null);
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
    render(null, cfg);
    return;
  }
  const cell = api.cell();
  if (!cell) {
    render(null, cfg);
    return;
  }
  if (cell !== current) {
    current = cell;
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

  const paused = userPaused || (cfg.autoHover && (navHovered() || chipHovered()));
  if (!paused) elapsed += dt;
  const progress = Math.min(1, elapsed / durationFor(cell, cfg));
  render({ cell, progress, paused, userPaused }, cfg);
  if (progress >= 1) {
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
  blockedAt = 0;
  userPaused = false;
  frame = requestAnimationFrame(tick);
}

export function stopAutoplay() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  current = null;
  elapsed = 0;
  setRing(null);
  renderBar(null, null);
}
