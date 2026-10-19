import { SEL } from '../../core/constants.js';
import { t } from '../../i18n/index.js';
import { icon } from '../../ui/icons.js';
import { el } from '../../utils/dom.js';

/**
 * Previous / next buttons of Shorts mode: two round buttons at the right edge
 * of the post column, vertically centred — where the current post always is.
 * They sit in the gap between the feed and the right column when it is wide
 * enough, and over the edge of the feed otherwise.
 */

const SIZE = 44;
const GAP = 16;
const MARGIN = 8;

let box = null;
let prev = null;
let next = null;
let onStep = null;

function makeButton(name, direction) {
  const button = el('button', 'xp-shorts-nav__btn');
  button.type = 'button';
  button.innerHTML = icon(name);
  // Keep the focus where it was: the arrow keys must keep working after a click.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onStep?.(direction);
  });
  return button;
}

function ensure(handler) {
  onStep = handler;
  if (box) return;
  box = el('div', 'xp-shorts-nav');
  box.setAttribute('role', 'group');
  prev = makeButton('chevronUp', -1);
  next = makeButton('chevronDown', 1);
  box.append(prev, next);
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

/**
 * @param {{ visible: boolean, canPrev: boolean, canNext: boolean }} state
 * @param {(direction: -1 | 1) => void} handler
 */
export function syncNav(state, handler) {
  if (!state.visible && !box) return;
  ensure(handler);
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
}

export function hideNav() {
  if (box) box.hidden = true;
}
