import { Codes, logError } from './debug.js';

/**
 * Minimal pub/sub bus. Events used across the script:
 *
 *  - `settings:changed`      { prev, next }   — any persisted settings change
 *  - `settings:<featureId>`  (cfg, prev)      — one feature's section changed
 *  - `scan`                  (root)           — debounced DOM change
 *  - `navigate`              (url)            — SPA URL change
 *  - `theme`                 (theme)          — X theme flipped
 */
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

/** Listener failures are isolated: one broken subscriber never blocks the rest. */
export function emit(event, ...args) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(...args);
    } catch (error) {
      logError(Codes.BUS_LISTENER, `listener for "${event}" failed`, { event, error });
    }
  });
}
