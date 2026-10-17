import { NAVIGATION_POLL_MS, SCAN_DEBOUNCE_MS } from './constants.js';
import { emit } from './bus.js';
import { debounce, each, isOwnNode } from '../utils/dom.js';

/**
 * Shared DOM observation. One MutationObserver feeds every consumer; added
 * nodes that belong to our own UI (or to a post we already enhanced) are
 * ignored so injected chrome never causes rescans of itself.
 */

const subscribers = new Set();
let observer = null;
let navigationHooked = false;
let lastUrl = '';

function isRelevantMutation(mutations) {
  for (const mutation of mutations) {
    for (let i = 0; i < mutation.addedNodes.length; i += 1) {
      const node = mutation.addedNodes[i];
      if (node.nodeType === 1 && !isOwnNode(node)) return true;
    }
  }
  return false;
}

function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (!isRelevantMutation(mutations)) return;
    each([...subscribers], (subscriber) => subscriber.schedule());
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

/**
 * Subscribe to relevant DOM changes. `wait` is the per-subscriber debounce;
 * latency-sensitive consumers (portaled menus) pass a small value.
 * @returns {() => void} unsubscribe
 */
export function onMutation(callback, wait = SCAN_DEBOUNCE_MS) {
  const subscriber = { schedule: debounce(callback, wait) };
  subscribers.add(subscriber);
  ensureObserver();
  return () => {
    subscriber.schedule.cancel();
    subscribers.delete(subscriber);
  };
}

/** Fire the debounced scan event on every DOM change. */
export function startScanning() {
  onMutation(() => emit('scan', document));
}

/** Request an immediate full rescan (after a settings change, navigation, …). */
export function scanNow() {
  emit('scan', document);
}

function patchHistory(type, notify) {
  const original = history[type];
  if (typeof original !== 'function') return;
  history[type] = function patched(...args) {
    const result = original.apply(this, args);
    notify();
    return result;
  };
}

/** X is a client-side SPA: combine History API hooks, popstate and URL polling. */
export function startNavigationWatch() {
  if (navigationHooked) return;
  navigationHooked = true;
  lastUrl = location.href;

  const check = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    emit('navigate', lastUrl);
    emit('scan', document);
  };
  const notify = debounce(check, 80);

  window.addEventListener('popstate', notify, true);
  patchHistory('pushState', notify);
  patchHistory('replaceState', notify);
  setInterval(check, NAVIGATION_POLL_MS);
}
