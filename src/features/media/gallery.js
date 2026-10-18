import { SEL } from '../../core/constants.js';
import { Codes, logError } from '../../core/debug.js';
import { icon } from '../../ui/icons.js';
import { lockPageScroll, unlockPageScroll } from '../../ui/scroll-lock.js';
import { showToast } from '../../ui/toast.js';
import { el } from '../../utils/dom.js';
import { formatBytes, sanitizeFileName } from '../../utils/format.js';
import { handleFromHref } from '../../utils/handle.js';
import { cfg, tm } from './config.js';
import { downloadFile } from './download.js';
import { buildFileName } from './filename.js';
import { getMediaHosts, getTweetId } from './tweet.js';

/**
 * Photo gallery. A click on a post photo opens our own full-screen viewer
 * instead of X's `…/photo/N` page, so nothing is fetched except the images:
 * no replies, no timeline, no route change.
 *
 *  - all photos of the post (or of the quoted post) in one carousel, with
 *    thumbnails, ← / → keys, buttons and swipe;
 *  - wheel / pinch zoom towards the cursor, drag to pan, double click toggles
 *    zoom, `+` `-` `0` keys; the original rendition loads while zoomed;
 *  - download (honours the file name template) and open-original buttons;
 *  - Esc, a click on the backdrop or a swipe down closes it.
 *
 * Ctrl / Cmd / Shift / Alt clicks and non-primary buttons are left to the
 * browser and X (open in a new tab, native viewer).
 */

const IMG_SELECTOR = 'img[src*="pbs.twimg.com/media/"]';
/** Below 1 the photo is smaller than the fitted size. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2.5;
const KEY_STEP = 1.4;
const DRAG_THRESHOLD = 5;
const SWIPE_DISTANCE = 60;
const SWIPE_CLOSE_DISTANCE = 110;
const PAN_MARGIN = 60;

/** Rendition shown in the gallery, and the one loaded after zooming. */
const VIEW_SIZE = 'large';
const FULL_SIZE = 'orig';

let installed = false;
/** @type {{ destroy: () => void } | null} */
let view = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ------------------------------------------------------------------ */
/* Slides                                                              */
/* ------------------------------------------------------------------ */

/** Same photo, another rendition (`name=small|large|orig`). */
function sized(src, name) {
  try {
    const url = new URL(src, location.href);
    url.searchParams.set('name', name);
    if (!url.searchParams.has('format')) {
      const ext = /\.(jpe?g|png|webp|gif)$/i.exec(url.pathname)?.[1];
      if (ext) url.searchParams.set('format', ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase());
    }
    return url.href;
  } catch {
    return src;
  }
}

function extensionOf(src) {
  try {
    const url = new URL(src, location.href);
    const format = url.searchParams.get('format') || /\.(jpe?g|png|webp|gif)$/i.exec(url.pathname)?.[1] || 'jpg';
    const lower = format.toLowerCase();
    return lower === 'jpeg' ? 'jpg' : lower;
  } catch {
    return 'jpg';
  }
}

/** What a download needs to know about the post the clicked photo belongs to. */
function postContext(article, owner) {
  if (owner === 'quote') {
    const quote = article.querySelector(SEL.quoteTweet);
    const handle = /@([A-Za-z0-9_]{1,15})/.exec(quote?.querySelector(SEL.userName)?.textContent || '');
    return { id: '', user: handle ? handle[1].toLowerCase() : '', createdAt: '', text: quote?.querySelector(SEL.tweetText)?.textContent || '' };
  }
  const link = [...article.querySelectorAll('a[href*="/status/"] time')]
    .map((time) => time.closest('a'))
    .find((a) => a && !a.closest(SEL.quoteTweet));
  return {
    id: getTweetId(article) || '',
    user: handleFromHref(link?.getAttribute('href')),
    createdAt: link?.querySelector('time')?.getAttribute('datetime') || '',
    text: article.querySelector(SEL.tweetText)?.textContent || '',
  };
}

/** Sensitive-content photos stay behind X's own warning. */
function isBlurred(img, host) {
  for (let node = img; node && node !== host.parentElement; node = node.parentElement) {
    if (/blur/.test(getComputedStyle(node).filter)) return true;
  }
  return false;
}

/**
 * Photos of the post a click landed in, in display order.
 * @returns {{ slides: object[], index: number, post: object } | null}
 */
function collect(host, article) {
  const hosts = getMediaHosts(article).filter((h) => h.kind === 'photo');
  const clicked = hosts.find((h) => h.el === host);
  if (!clicked) return null;

  const slides = [];
  let index = -1;
  for (const candidate of hosts) {
    if (candidate.owner !== clicked.owner) continue;
    const img = candidate.el.querySelector(IMG_SELECTOR);
    if (!img) continue;
    if (isBlurred(img, candidate.el)) {
      if (candidate === clicked) return null;
      continue;
    }
    const thumb = img.currentSrc || img.src;
    if (candidate === clicked) index = slides.length;
    slides.push({
      thumb: sized(thumb, 'small'),
      view: sized(thumb, VIEW_SIZE),
      full: sized(thumb, FULL_SIZE),
      alt: img.alt || '',
    });
  }
  if (index < 0) return null;
  return { slides, index, post: postContext(article, clicked.owner) };
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function iconButton(className, iconName, label, onActivate) {
  const node = el('button', className);
  node.type = 'button';
  node.innerHTML = icon(iconName);
  node.title = label;
  node.setAttribute('aria-label', label);
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    onActivate();
  });
  return node;
}

function createView({ slides, index, post }) {
  const state = {
    slides,
    index,
    post,
    scale: 1,
    x: 0,
    y: 0,
    /** Active pointers: id → {x, y}. */
    pointers: new Map(),
    pinchDistance: 0,
    start: { x: 0, y: 0 },
    /** Whether the current gesture started on the photo itself. */
    downOnPhoto: false,
    moved: false,
    busy: false,
    opener: document.activeElement,
    /** Bumped on every slide change so late image loads are ignored. */
    token: 0,
  };

  const root = el('div', 'xp-gallery');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', tm('gallery'));
  root.tabIndex = -1;
  root.classList.toggle('has-strip', slides.length > 1);

  const stage = el('div', 'xp-gallery__stage');
  const img = el('img', 'xp-gallery__img');
  img.draggable = false;
  img.decoding = 'async';
  const spinner = el('span', 'xp-gallery__spinner');
  spinner.setAttribute('aria-hidden', 'true');
  stage.append(img, spinner);

  const counter = el('span', 'xp-gallery__counter');
  const close = iconButton('xp-gallery__btn', 'close', tm('galleryClose'), () => closeGallery());
  const open = el('a', 'xp-gallery__btn');
  open.innerHTML = icon('external');
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.title = tm('galleryOpenOriginal');
  open.setAttribute('aria-label', tm('galleryOpenOriginal'));
  open.addEventListener('click', (event) => event.stopPropagation());
  const save = iconButton('xp-gallery__btn', 'download', tm('galleryDownload'), () => saveCurrent());
  save.insertAdjacentHTML('beforeend', '<span class="xp-gallery__btnspin" aria-hidden="true"></span>');

  const bar = el('div', 'xp-gallery__bar');
  const actions = el('div', 'xp-gallery__actions');
  actions.append(open, save);
  bar.append(close, counter, actions);

  const prev = iconButton('xp-gallery__nav xp-gallery__nav--prev', 'chevronLeft', tm('galleryPrev'), () => go(-1));
  const next = iconButton('xp-gallery__nav xp-gallery__nav--next', 'chevronRight', tm('galleryNext'), () => go(1));

  const zoomOut = el('button', 'xp-gallery__zbtn', '−');
  const zoomIn = el('button', 'xp-gallery__zbtn', '+');
  const level = el('button', 'xp-gallery__zbtn xp-gallery__level', '100%');
  for (const [node, label, handler] of [
    [zoomOut, tm('zoomOut'), () => stepZoom(1 / KEY_STEP)],
    [zoomIn, tm('zoomIn'), () => stepZoom(KEY_STEP)],
    [level, tm('galleryActualSize'), () => toggleActualSize()],
  ]) {
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      handler();
    });
  }
  const zoom = el('div', 'xp-gallery__zoom');
  zoom.setAttribute('role', 'group');
  zoom.append(zoomOut, level, zoomIn);

  const strip = el('div', 'xp-gallery__strip');
  const thumbs = slides.map((slide, i) => {
    const thumb = el('button', 'xp-gallery__thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', tm('galleryPhoto', { n: i + 1 }));
    const picture = el('img');
    picture.src = slide.thumb;
    picture.alt = '';
    picture.draggable = false;
    thumb.append(picture);
    thumb.addEventListener('click', (event) => {
      event.stopPropagation();
      show(i);
    });
    strip.append(thumb);
    return thumb;
  });
  strip.hidden = slides.length < 2;
  prev.hidden = slides.length < 2;
  next.hidden = slides.length < 2;

  const bottom = el('div', 'xp-gallery__bottom');
  bottom.append(zoom, strip);
  root.append(stage, bar, prev, next, bottom);

  /* ---- geometry ---- */

  function stageBox() {
    return stage.getBoundingClientRect();
  }

  /** Size of the photo as drawn at scale 1 (the <img> box is larger: object-fit: contain). */
  function fitSize() {
    const boxW = img.offsetWidth;
    const boxH = img.offsetHeight;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return { width: boxW, height: boxH };
    const ratio = Math.min(boxW / natW, boxH / natH);
    return { width: natW * ratio, height: natH * ratio };
  }

  /** Keep the photo from leaving the stage; a photo smaller than the stage stays centred. */
  function clampPan() {
    const box = stageBox();
    const fit = fitSize();
    const margin = state.scale > 1 ? PAN_MARGIN : 0;
    const limitX = Math.max(0, (fit.width * state.scale - box.width) / 2 + margin);
    const limitY = Math.max(0, (fit.height * state.scale - box.height) / 2 + margin);
    state.x = clamp(state.x, -limitX, limitX);
    state.y = clamp(state.y, -limitY, limitY);
  }

  function render(animate = false) {
    if (Math.abs(state.scale - 1) < 0.02) {
      state.scale = 1;
      if (!state.pointers.size) {
        state.x = 0;
        state.y = 0;
      }
    }
    img.style.transition = animate ? 'transform 0.18s ease' : 'none';
    img.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    root.classList.toggle('is-zoomed', state.scale > 1);
    const natural = img.naturalWidth || 0;
    level.textContent = natural ? `${Math.round(state.scale * (fitSize().width / natural) * 100)}%` : '';
  }

  /** Zoom to `target`, keeping the screen point (px, py) fixed. */
  function zoomAt(px, py, target, animate = false) {
    const next = clamp(target, MIN_SCALE, MAX_SCALE);
    // Centre of the <img> box without the current pan (it is not the stage centre: the bars take room).
    const rect = img.getBoundingClientRect();
    const dx = px - (rect.left + rect.width / 2 - state.x);
    const dy = py - (rect.top + rect.height / 2 - state.y);
    const ratio = next / state.scale;
    state.x = dx - (dx - state.x) * ratio;
    state.y = dy - (dy - state.y) * ratio;
    state.scale = next;
    clampPan();
    render(animate);
    if (next > 1) loadFull();
  }

  function zoomCentre(target, animate = true) {
    const rect = img.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, target, animate);
  }

  function stepZoom(factor) {
    zoomCentre(state.scale * factor);
  }

  function resetZoom(animate = true) {
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    render(animate);
  }

  /** Fit ↔ real pixels. */
  function toggleActualSize() {
    const natural = img.naturalWidth || 0;
    const fitWidth = fitSize().width;
    const actual = natural && fitWidth ? natural / fitWidth : 1;
    if (state.scale !== 1 || actual <= 1.05) resetZoom();
    else zoomCentre(actual);
  }

  /* ---- slide loading ---- */

  function setImage(src) {
    if (img.src !== src) img.src = src;
  }

  /** Swap in the original rendition once the user zooms. */
  function loadFull() {
    const slide = state.slides[state.index];
    if (!slide || slide.fullLoaded || slide.fullLoading) return;
    slide.fullLoading = true;
    const token = state.token;
    const probe = new Image();
    probe.onload = () => {
      slide.fullLoading = false;
      slide.fullLoaded = true;
      if (state.token === token) {
        setImage(slide.full);
        render();
      }
    };
    probe.onerror = () => {
      slide.fullLoading = false;
    };
    probe.src = slide.full;
  }

  function preload(i) {
    const slide = state.slides[i];
    if (!slide || slide.preloaded) return;
    slide.preloaded = true;
    new Image().src = slide.view;
  }

  function show(i, animate = true) {
    const target = clamp(i, 0, state.slides.length - 1);
    if (animate && target === state.index) return;
    state.index = target;
    state.token += 1;
    const token = state.token;
    const slide = state.slides[target];

    resetZoom(false);
    root.classList.add('is-loading');
    root.classList.remove('is-error');
    img.alt = slide.alt;
    // The feed thumbnail is already cached: show it right away, then the sharper one.
    setImage(slide.fullLoaded ? slide.full : slide.thumb);
    if (animate) {
      img.classList.remove('is-swap');
      void img.offsetWidth;
      img.classList.add('is-swap');
    }

    if (slide.fullLoaded) {
      root.classList.remove('is-loading');
    } else {
      const probe = new Image();
      probe.onload = () => {
        if (state.token !== token) return;
        setImage(slide.view);
        root.classList.remove('is-loading');
        render();
      };
      probe.onerror = () => {
        if (state.token !== token) return;
        root.classList.remove('is-loading');
        root.classList.add('is-error');
      };
      probe.src = slide.view;
    }

    counter.textContent = state.slides.length > 1 ? `${target + 1} / ${state.slides.length}` : '';
    open.href = slide.full;
    prev.disabled = target === 0;
    next.disabled = target === state.slides.length - 1;
    thumbs.forEach((thumb, n) => {
      thumb.classList.toggle('is-active', n === target);
      thumb.setAttribute('aria-current', n === target ? 'true' : 'false');
    });
    thumbs[target].scrollIntoView({ block: 'nearest', inline: 'center', behavior: animate ? 'smooth' : 'auto' });
    preload(target - 1);
    preload(target + 1);
  }

  function go(step) {
    show(state.index + step);
  }

  /* ---- download ---- */

  async function saveCurrent() {
    if (state.busy) return;
    const slide = state.slides[state.index];
    const base = buildFileName(cfg().fileTemplate, {
      user: state.post.user,
      id: state.post.id,
      createdAt: state.post.createdAt,
      n: state.index + 1,
      quality: FULL_SIZE,
      type: 'photo',
      text: state.post.text,
    });
    const fileName = `${sanitizeFileName(base)}.${extensionOf(slide.full)}`;
    state.busy = true;
    save.classList.add('is-loading');
    const toast = showToast(fileName, { title: tm('downloading'), duration: 0 });
    try {
      const bytes = await downloadFile({
        url: slide.full,
        fileName,
        onProgress: (ratio) => toast.update({ progress: ratio == null ? 0 : ratio }),
      });
      toast.update({
        type: 'success',
        title: tm('saved'),
        message: tm('savedText', { count: 1, size: formatBytes(bytes) }),
        progress: 1,
        duration: 4000,
      });
    } catch (error) {
      logError(Codes.MEDIA_DOWNLOAD, 'failed to download gallery photo', { url: slide.full, error });
      toast.dismiss();
      showToast(tm('failed'), { type: 'error', force: true });
    } finally {
      state.busy = false;
      save.classList.remove('is-loading');
    }
  }

  /* ---- input ---- */

  function onWheel(event) {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    const speed = event.ctrlKey ? 0.01 : 0.0018;
    zoomAt(event.clientX, event.clientY, state.scale * Math.exp(-event.deltaY * unit * speed));
  }

  function pinchDistance() {
    const [a, b] = [...state.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** True when the screen point is on the drawn photo (not on the empty stage around it). */
  function onPhoto(x, y) {
    const box = img.getBoundingClientRect();
    const fit = fitSize();
    const width = fit.width * state.scale;
    const height = fit.height * state.scale;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    return Math.abs(x - cx) <= width / 2 && Math.abs(y - cy) <= height / 2;
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stage.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size === 1) {
      state.downOnPhoto = onPhoto(event.clientX, event.clientY);
      state.start = { x: event.clientX, y: event.clientY };
      state.moved = false;
    } else if (state.pointers.size === 2) {
      state.pinchDistance = pinchDistance();
      state.moved = true;
    }
    if (state.downOnPhoto) stage.classList.add('is-grabbing');
  }

  function onPointerMove(event) {
    if (!state.pointers.size) {
      stage.classList.toggle('is-over-photo', onPhoto(event.clientX, event.clientY));
    }
    const last = state.pointers.get(event.pointerId);
    if (!last) return;
    const point = { x: event.clientX, y: event.clientY };
    state.pointers.set(event.pointerId, point);

    if (state.pointers.size >= 2) {
      const distance = pinchDistance();
      const [a, b] = [...state.pointers.values()];
      if (state.pinchDistance > 0) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, state.scale * (distance / state.pinchDistance));
      }
      state.pinchDistance = distance;
      return;
    }

    if (!state.moved && Math.hypot(point.x - state.start.x, point.y - state.start.y) < DRAG_THRESHOLD) return;
    state.moved = true;
    // A drag that started on the empty stage does nothing (the photo stays put).
    if (!state.downOnPhoto) return;
    if (state.scale > 1) {
      state.x += point.x - last.x;
      state.y += point.y - last.y;
      clampPan();
      render();
    } else {
      // Fit view: the photo follows the pointer, release decides (swipe / close).
      state.x = point.x - state.start.x;
      state.y = point.y - state.start.y;
      img.style.transition = 'none';
      img.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    }
  }

  function onPointerEnd(event) {
    if (!state.pointers.delete(event.pointerId)) return;
    state.pinchDistance = 0;
    if (state.pointers.size) {
      // One finger left after a pinch: continue panning from where it is.
      state.start = { ...[...state.pointers.values()][0] };
      return;
    }
    stage.classList.remove('is-grabbing');
    const { x: dx, y: dy } = state;
    if (!state.downOnPhoto) {
      // Click on the empty stage closes; a drag that started there is ignored.
      if (!state.moved && event.type === 'pointerup') closeGallery();
      return;
    }
    if (!state.moved) {
      // A plain click on empty space closes, on the photo does nothing.
      return;
    }
    if (state.scale > 1) {
      render();
    } else if (dy > SWIPE_CLOSE_DISTANCE && Math.abs(dy) > Math.abs(dx)) {
      closeGallery();
    } else if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) && state.slides.length > 1) {
      state.x = 0;
      state.y = 0;
      go(dx < 0 ? 1 : -1);
      render();
    } else {
      state.x = 0;
      state.y = 0;
      render(true);
    }
  }

  function onDoubleClick(event) {
    if (!onPhoto(event.clientX, event.clientY)) return;
    if (state.scale !== 1) resetZoom();
    else zoomAt(event.clientX, event.clientY, DOUBLE_CLICK_SCALE, true);
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // The page behind must not react to its own shortcuts (j / k / l …).
    event.stopImmediatePropagation();
    switch (event.key) {
      case 'Escape':
        closeGallery();
        break;
      case 'ArrowLeft':
        if (state.scale > 1) return;
        go(-1);
        break;
      case 'ArrowRight':
        if (state.scale > 1) return;
        go(1);
        break;
      case 'Home':
        show(0);
        break;
      case 'End':
        show(state.slides.length - 1);
        break;
      case '+':
      case '=':
        stepZoom(KEY_STEP);
        break;
      case '-':
      case '_':
        stepZoom(1 / KEY_STEP);
        break;
      case '0':
        resetZoom();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  const onResize = () => {
    clampPan();
    render();
  };

  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerEnd);
  stage.addEventListener('pointercancel', onPointerEnd);
  stage.addEventListener('dblclick', onDoubleClick);
  img.addEventListener('load', () => render());
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize);

  document.body.append(root);
  lockPageScroll();
  show(index, false);
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    close.focus({ preventScroll: true });
  });

  return {
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);
      state.token += 1;
      root.remove();
      unlockPageScroll();
      const { opener } = state;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Opening                                                             */
/* ------------------------------------------------------------------ */

export function closeGallery() {
  if (!view) return;
  const current = view;
  view = null;
  current.destroy();
}

/** Primary click on a post photo → our gallery instead of X's photo page. */
function onClick(event) {
  if (!cfg().photoGallery || view) return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const { target } = event;
  if (!(target instanceof Element) || target.closest('[data-xp-ui]')) return;

  const host = target.closest(SEL.photo);
  if (!host) return;
  // Buttons on the photo (sensitive-content reveal, alt text, …) keep their job.
  const control = target.closest('button, [role="button"]');
  if (control && control !== host && host.contains(control)) return;
  const article = host.closest(SEL.article);
  if (!article) return;

  const data = collect(host, article);
  if (!data) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  view = createView(data);
}

/**
 * Called on settings change and DOM scans: wires the click listener once and
 * closes the gallery when the setting is turned off.
 */
export function syncGallery() {
  const on = cfg().photoGallery;
  if (on && !installed) {
    installed = true;
    document.addEventListener('click', onClick, true);
  } else if (!on && installed) {
    installed = false;
    document.removeEventListener('click', onClick, true);
  }
  if (!on) closeGallery();
}
