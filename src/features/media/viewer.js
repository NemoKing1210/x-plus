import { el, silencePointerEvents } from '../../utils/dom.js';
import { cfg, tm } from './config.js';

/**
 * Photo viewer zoom. In X's full-screen photo view (`…/photo/N`):
 *
 *  - mouse wheel / trackpad pinch zooms towards the cursor;
 *  - drag pans a zoomed photo (touch: one finger pans, two fingers pinch);
 *  - double click toggles between fit and 2.5×;
 *  - `+` / `-` zoom, `0` resets;
 *  - a small pill shows the zoom level with −, + and reset controls.
 *
 * The transform is applied straight to X's own <img>, so everything X does
 * (arrows, close, swipe) keeps working at 100 % and is paused only while the
 * photo is zoomed in and being dragged.
 */

const LAYER = '[data-testid="swipe-to-dismiss"], [role="dialog"][aria-modal="true"]';
const VIEWER_IMG = `:is(${LAYER}) img[src*="pbs.twimg.com/media/"]`;

const GRID_ATTR = 'data-xp-grid';
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2.5;
const KEY_STEP = 1.4;
const DRAG_THRESHOLD = 4;
const EDIT_TARGET = 'input, textarea, select, [contenteditable="true"]';

const state = {
  img: null,
  /** Element that gets the transform: the <img> plus the wrapper X paints the photo with. */
  node: null,
  /** Full-screen layer behind the photo (gets the grid). */
  layer: null,
  src: '',
  scale: 1,
  x: 0,
  y: 0,
  /** Active pointers: id → {x, y}. */
  pointers: new Map(),
  pinchDistance: 0,
  dragMoved: false,
  suppressClick: false,
};

let installed = false;
let pill = null;
let pillLabel = null;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const enabled = () => cfg().photoZoom;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function viewerImages() {
  return [...document.querySelectorAll(VIEWER_IMG)];
}

/** The visible photo under the pointer (the carousel keeps neighbours off-screen). */
function imageAt(x, y) {
  for (const img of viewerImages()) {
    const rect = img.getBoundingClientRect();
    if (rect.width > 40 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return img;
    }
  }
  return null;
}

function adopt(img) {
  if (state.img === img && state.src === img.src) return;
  clearImage(state.node);
  state.layer?.removeAttribute(GRID_ATTR);
  state.img = img;
  state.node = transformTarget(img);
  state.layer = gridHost(img);
  syncGrid();
  state.src = img.src;
  state.scale = 1;
  state.x = 0;
  state.y = 0;
}

/**
 * X may paint the photo with a background layer next to a hidden <img>, so
 * transform the smallest wrapper that is the same size as the <img>.
 */
function transformTarget(img) {
  const box = img.getBoundingClientRect();
  let node = img;
  for (let i = 0; i < 3; i += 1) {
    const parent = node.parentElement;
    if (!parent || parent === document.body) break;
    const rect = parent.getBoundingClientRect();
    if (rect.width > box.width * 1.03 + 2 || rect.height > box.height * 1.03 + 2) break;
    node = parent;
  }
  return node;
}

function clearImage(img) {
  if (!img) return;
  img.style.removeProperty('transform');
  img.style.removeProperty('transition');
  img.style.removeProperty('cursor');
  img.style.removeProperty('will-change');
}

/** Keep the photo from being dragged completely out of view. */
function clampPan() {
  const node = state.node;
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const baseW = rect.width / state.scale;
  const baseH = rect.height / state.scale;
  const limitX = Math.max(0, (baseW * state.scale + window.innerWidth) / 2 - 80);
  const limitY = Math.max(0, (baseH * state.scale + window.innerHeight) / 2 - 80);
  state.x = clamp(state.x, -limitX, limitX);
  state.y = clamp(state.y, -limitY, limitY);
}

function render(animate = false) {
  const img = state.node;
  if (!img) return;
  if (Math.abs(state.scale - 1) < 0.02) state.scale = 1;
  img.style.willChange = 'transform';
  img.style.transition = animate ? 'transform 0.18s ease' : 'none';
  img.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
  img.style.cursor = 'grab';
  renderPill();
}

/** Zoom to `next`, keeping the point (px, py) of the screen fixed. */
function zoomAt(px, py, next, animate = false) {
  const img = state.img;
  if (!img || !state.node) return;
  const target = clamp(next, MIN_SCALE, MAX_SCALE);
  // Screen → image-centre coordinates at the current transform.
  const rect = state.node.getBoundingClientRect();
  const cx = rect.left + rect.width / 2 - state.x;
  const cy = rect.top + rect.height / 2 - state.y;
  const ratio = target / state.scale;
  state.x = px - cx - (px - cx - state.x) * ratio;
  state.y = py - cy - (py - cy - state.y) * ratio;
  state.scale = target;
  clampPan();
  render(animate);
  if (target > 1) loadSharper(img);
}

function resetZoom(animate = true) {
  if (!state.img) return;
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  render(animate);
}

/** While zoomed, swap in the original rendition so details stay crisp. */
function loadSharper(img) {
  let url;
  try {
    url = new URL(img.src);
  } catch {
    return;
  }
  if (url.searchParams.get('name') === 'orig' || !url.searchParams.has('name')) return;
  url.searchParams.set('name', 'orig');
  const next = url.href;
  const probe = new Image();
  probe.onload = () => {
    if (state.img !== img || img.src === next) return;
    img.src = next;
    state.src = img.src;
  };
  probe.src = next;
}

/**
 * The photo stage: the nearest ancestor with the dimming inline
 * `background-color` (X's class names are unstable); falls back to the
 * innermost ancestor that fills the viewport.
 */
function gridHost(img) {
  const layer = img.closest(LAYER);
  // X dims the page with an inline `background-color` on the stage element.
  for (let node = img.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.style.backgroundColor) return node;
  }
  for (let node = img.parentElement; node && node !== layer; node = node.parentElement) {
    const rect = node.getBoundingClientRect();
    if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.95) return node;
  }
  return layer;
}

/** Grid behind the photo so any picture stands out. */
function syncGrid() {
  const on = enabled() && cfg().photoGrid;
  state.layer?.toggleAttribute(GRID_ATTR, on);
}

/* ------------------------------------------------------------------ */
/* Zoom indicator                                                      */
/* ------------------------------------------------------------------ */

function pillButton(label, text, onActivate) {
  const button = el('button', 'xp-zoom__btn', text);
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  silencePointerEvents(button);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });
  return button;
}

function ensurePill() {
  if (pill) return pill;
  pill = el('div', 'xp-zoom');
  pill.setAttribute('role', 'group');
  pillLabel = pillButton(tm('zoomReset'), '100%', () => resetZoom());
  pillLabel.classList.add('xp-zoom__level');
  pill.append(
    pillButton(tm('zoomOut'), '−', () => stepZoom(1 / KEY_STEP)),
    pillLabel,
    pillButton(tm('zoomIn'), '+', () => stepZoom(KEY_STEP)),
  );
  document.body.append(pill);
  return pill;
}

function renderPill() {
  const visible = Boolean(state.img) && (state.scale !== 1 || state.x !== 0 || state.y !== 0);
  if (!visible && !pill) return;
  ensurePill();
  pill.classList.toggle('is-visible', visible);
  if (visible && state.layer) {
    // Centre on the photo stage (the grid element) and keep clear of X's action bar.
    const rect = state.layer.getBoundingClientRect();
    pill.style.left = `${rect.left + rect.width / 2}px`;
    pill.style.bottom = `${Math.max(0, window.innerHeight - rect.bottom) + 88}px`;
  }
  if (visible) pillLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

function stepZoom(factor) {
  const img = state.img ?? viewerImages().find((node) => node.getBoundingClientRect().width > 40);
  if (!img) return;
  adopt(img);
  zoomAt(window.innerWidth / 2, window.innerHeight / 2, state.scale * factor, true);
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */



function onWheel(event) {
  if (!enabled()) return;
  const img = imageAt(event.clientX, event.clientY);
  if (!img) return;
  event.preventDefault();
  event.stopPropagation();
  adopt(img);
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
  const speed = event.ctrlKey ? 0.01 : 0.0018;
  const factor = Math.exp(-event.deltaY * unit * speed);
  zoomAt(event.clientX, event.clientY, state.scale * factor);
}

function pinchDistance() {
  const [a, b] = [...state.pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function onPointerDown(event) {
  if (!enabled()) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const img = imageAt(event.clientX, event.clientY);
  if (!img) return;
  adopt(img);
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  state.dragMoved = false;
  if (state.pointers.size === 2) state.pinchDistance = pinchDistance();
  // Dragging a photo is ours, not X's swipe-to-dismiss.
  event.stopPropagation();
  event.preventDefault();
  if (state.node) state.node.style.cursor = 'grabbing';
}

function onPointerMove(event) {
  const last = state.pointers.get(event.pointerId);
  if (!last || !state.img) return;
  const point = { x: event.clientX, y: event.clientY };
  state.pointers.set(event.pointerId, point);

  if (state.pointers.size >= 2) {
    const distance = pinchDistance();
    const [a, b] = [...state.pointers.values()];
    if (state.pinchDistance > 0) {
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, state.scale * (distance / state.pinchDistance));
    }
    state.pinchDistance = distance;
    state.dragMoved = true;
    event.preventDefault();
    return;
  }

  const dx = point.x - last.x;
  const dy = point.y - last.y;
  if (!state.dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
    // Keep sub-threshold moves for the next event so a click stays a click.
    state.pointers.set(event.pointerId, last);
    return;
  }
  state.dragMoved = true;
  state.x += dx;
  state.y += dy;
  clampPan();
  render();
  event.preventDefault();
  event.stopPropagation();
}

function onPointerEnd(event) {
  if (!state.pointers.delete(event.pointerId)) return;
  state.pinchDistance = 0;
  if (state.dragMoved) {
    // The click that follows a drag must not close the viewer.
    state.suppressClick = true;
    setTimeout(() => {
      state.suppressClick = false;
    }, 0);
  }
  if (!state.pointers.size) state.dragMoved = false;
  if (state.img) render();
}

function onClick(event) {
  if (!state.suppressClick) return;
  event.preventDefault();
  event.stopPropagation();
}

function onDoubleClick(event) {
  if (!enabled()) return;
  const img = imageAt(event.clientX, event.clientY);
  if (!img) return;
  event.preventDefault();
  event.stopPropagation();
  adopt(img);
  if (state.scale !== 1 || state.x !== 0 || state.y !== 0) resetZoom();
  else zoomAt(event.clientX, event.clientY, DOUBLE_CLICK_SCALE, true);
}

function onKeyDown(event) {
  if (!enabled() || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest(EDIT_TARGET)) return;
  if (!viewerImages().length) return;
  if (event.key === '+' || event.key === '=') stepZoom(KEY_STEP);
  else if (event.key === '-' || event.key === '_') stepZoom(1 / KEY_STEP);
  else if (event.key === '0') resetZoom();
  else return;
  event.preventDefault();
  event.stopPropagation();
}

function onDragStart(event) {
  if (enabled() && event.target instanceof Element && event.target.matches(VIEWER_IMG)) {
    event.preventDefault();
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function install() {
  if (installed) return;
  installed = true;
  const capture = { capture: true };
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
  document.addEventListener('pointerdown', onPointerDown, capture);
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  document.addEventListener('pointerup', onPointerEnd, capture);
  document.addEventListener('pointercancel', onPointerEnd, capture);
  document.addEventListener('click', onClick, capture);
  document.addEventListener('dblclick', onDoubleClick, capture);
  document.addEventListener('keydown', onKeyDown, capture);
  document.addEventListener('dragstart', onDragStart, capture);
}

/**
 * Called on settings change, DOM scans and navigation: wires the listeners
 * once and drops zoom state when the viewer closed or moved to another photo.
 */
export function syncPhotoViewer() {
  if (enabled()) install();
  if (enabled() && !state.img) {
    const first = viewerImages().find((node) => node.getBoundingClientRect().width > 40);
    if (first) adopt(first);
  }
  syncGrid();
  const img = state.img;
  if (!img) return;
  const gone = !img.isConnected || !enabled();
  if (gone || (state.src !== img.src && !img.src.includes(state.src.split('?')[0]))) {
    clearImage(state.node);
    state.layer?.removeAttribute(GRID_ATTR);
    state.layer = null;
    state.img = null;
    state.node = null;
    state.src = '';
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    state.pointers.clear();
    renderPill();
  }
}
