import { OWN_SELECTOR, UI_ATTR } from '../core/constants.js';

/**
 * Create an element. `className` may be empty; `text` becomes textContent.
 * Every element made through `el()` is flagged as our own UI so DOM scans
 * never react to it.
 */
export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  node.setAttribute(UI_ATTR, '');
  return node;
}

/** True for nodes that are (or live inside) our own UI or an enhanced post. */
export function isOwnNode(node) {
  const element = node?.nodeType === 1 ? node : node?.parentElement;
  return Boolean(element?.closest?.(OWN_SELECTOR));
}

export function debounce(fn, wait) {
  let timer = 0;
  const debounced = function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/** Iterate arrays and array-likes (NodeList, mutation lists) alike. */
export function each(list, visit) {
  for (let i = 0; i < list.length; i += 1) visit(list[i], i);
}

/** `fn` once the DOM is ready to be touched. */
export function whenReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

/**
 * Stop X's post-open handlers without killing our own click: swallow the
 * pointer sequence on the element in the capture phase.
 */
const QUIET_POINTER_EVENTS = [
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
];

export function silencePointerEvents(target) {
  const quiet = (event) => event.stopPropagation();
  for (const type of QUIET_POINTER_EVENTS) {
    target.addEventListener(type, quiet, true);
  }
}
