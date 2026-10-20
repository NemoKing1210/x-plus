import { SEL } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { icon } from '../../ui/icons.js';
import { el } from '../../utils/dom.js';
import { keyLabel } from '../../utils/keys.js';

/**
 * Controls of Shorts mode: previous / next buttons and an auto-scroll
 * play / pause button, in a column at the right edge of the post column,
 * vertically centred — where the current post always is. They sit in the gap
 * between the feed and the right column when it is wide enough, and over the
 * edge of the feed otherwise. The "next" button carries the auto-scroll ring.
 *
 * @typedef {object} NavActions
 * @property {(direction: -1 | 1) => void} step   previous / next post
 * @property {() => void} toggleAuto               start / pause / resume auto-scroll
 */

/** Length of the press animation (styles/shorts.css), plus a little. */
const PRESS_MS = 380;
const SIZE = 44;
const GAP = 16;
const MARGIN = 8;
/** Circumference of the ring (r = 25), matches stroke-dasharray in the CSS. */
const RING_LENGTH = 2 * Math.PI * 25;

const RING_SVG = `<svg class="xp-shorts-ring" viewBox="0 0 56 56" aria-hidden="true" focusable="false">
  <circle class="xp-shorts-ring__track" cx="28" cy="28" r="25"/>
  <circle class="xp-shorts-ring__arc" cx="28" cy="28" r="25"/>
</svg>`;

let box = null;
let prev = null;
let next = null;
let auto = null;
let arc = null;
let ringSvg = null;
/** @type {NavActions | null} */
let actions = null;
const pressTimers = new WeakMap();

function makeButton(name, direction) {
  const button = el('button', 'xp-shorts-nav__btn');
  button.type = 'button';
  button.style.setProperty('--xp-nudge', `${direction * 4}px`);
  button.innerHTML = icon(name);
  // Keep the focus where it was: the arrow keys must keep working after a click.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    actions?.step(direction);
  });
  return button;
}

function makeAutoButton() {
  const button = el('button', 'xp-shorts-nav__btn xp-shorts-nav__btn--auto');
  button.type = 'button';
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    actions?.toggleAuto();
  });
  return button;
}

function ensure(handlers) {
  actions = handlers;
  if (box) return;
  box = el('div', 'xp-shorts-nav');
  box.setAttribute('role', 'group');
  prev = makeButton('chevronUp', -1);
  next = makeButton('chevronDown', 1);
  next.classList.add('xp-shorts-nav__btn--next');
  next.insertAdjacentHTML('beforeend', RING_SVG);
  ringSvg = next.querySelector('.xp-shorts-ring');
  arc = next.querySelector('.xp-shorts-ring__arc');
  auto = makeAutoButton();
  box.append(prev, next, auto);
  (document.body || document.documentElement).appendChild(box);
}

function place() {
  const column = document.querySelector(SEL.primaryColumn)?.getBoundingClientRect();
  if (!column?.width) return;
  const side = document.querySelector(SEL.sidebar)?.getBoundingClientRect();
  const edge = side?.width ? side.left : window.innerWidth;
  const free = edge - column.right;
  const left = free >= SIZE + GAP ? column.right + (free - SIZE) / 2 : column.right - SIZE - MARGIN;
  const clamped = Math.min(Math.max(left, MARGIN), window.innerWidth - SIZE - MARGIN);
  box.style.left = `${Math.round(clamped)}px`;
}

/** @param {'off' | 'running' | 'paused'} mode */
function syncAutoButton(mode) {
  if (auto.dataset.mode !== mode) {
    auto.dataset.mode = mode;
    auto.innerHTML = icon(mode === 'running' ? 'pause' : 'play');
    auto.classList.toggle('is-on', mode === 'running');
    auto.classList.toggle('is-paused', mode === 'paused');
  }
  const cfg = getFeatureSettings('shorts');
  const key = mode !== 'off' && cfg.autoKey ? ` (${keyLabel(cfg.autoKey)})` : '';
  const label = t(mode === 'running' ? 'shorts.autoPause' : mode === 'paused' ? 'shorts.autoResume' : 'shorts.autoPlay');
  auto.title = `${label}${key}`;
  auto.setAttribute('aria-label', label);
  auto.setAttribute('aria-pressed', String(mode === 'running'));
}

/**
 * @param {{ visible: boolean, canPrev: boolean, canNext: boolean, auto: 'off' | 'running' | 'paused' }} state
 * @param {NavActions} handlers
 */
export function syncNav(state, handlers) {
  if (!state.visible && !box) return;
  ensure(handlers);
  box.hidden = !state.visible;
  if (!state.visible) return;

  place();
  prev.disabled = !state.canPrev;
  next.disabled = !state.canNext;
  for (const [button, key] of [[prev, 'shorts.prev'], [next, 'shorts.next']]) {
    const label = t(key);
    button.title = label;
    button.setAttribute('aria-label', label);
  }
  syncAutoButton(state.auto);
}

/** Whether the controls are on screen (auto-scroll then shows its ring on them). */
export function navVisible() {
  return Boolean(box) && !box.hidden;
}

/** Whether the pointer rests on the controls. */
export function navHovered() {
  return navVisible() && box.matches(':hover');
}

/**
 * Auto-scroll ring around the "next" button; `null` hides it.
 * @param {{ progress: number, paused: boolean } | null} state
 */
export function setRing(state) {
  if (!ringSvg) return;
  ringSvg.classList.toggle('is-on', Boolean(state));
  if (!state) return;
  ringSvg.classList.toggle('is-paused', state.paused);
  arc.style.strokeDashoffset = String(RING_LENGTH * (1 - state.progress));
}

/**
 * Play the press animation on a button: -1 previous, 1 next, 0 auto-scroll
 * (a key or the wheel did what the button does).
 */
export function pulseNav(direction) {
  const button = direction === 0 ? auto : direction < 0 ? prev : next;
  if (!button || box.hidden || button.disabled) return;
  button.classList.remove('is-pressed');
  // Force a reflow so the animation restarts on quick repeats.
  void button.offsetWidth;
  button.classList.add('is-pressed');
  clearTimeout(pressTimers.get(button));
  pressTimers.set(button, setTimeout(() => button.classList.remove('is-pressed'), PRESS_MS));
}

export function hideNav() {
  if (box) box.hidden = true;
}
