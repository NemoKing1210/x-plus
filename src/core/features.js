import { Codes, logError } from './debug.js';

/**
 * Feature registry — the extension point of the whole script.
 *
 * A feature is a self-contained module that owns one section of the
 * settings object (`settings[id]`), optionally contributes settings tabs and
 * reacts to the lifecycle hooks below. Registering a feature is all that is
 * needed to get persisted + normalized settings, a settings tab, and DOM
 * scan callbacks.
 *
 * @typedef {object} FeatureDefinition
 * @property {string} id                       - settings key, unique
 * @property {number} [order]                  - init / tab order (lower first)
 * @property {Record<string, object>} fields   - settings schema (core/schema.js)
 * @property {object[]} [tabs]                 - settings tabs (see features/settings/spec.js)
 * @property {() => void} [init]               - once, after settings are loaded
 * @property {(cfg: object, prev: object|null) => void} [apply] - init + every change of this section
 * @property {(root: ParentNode) => void} [scan]  - debounced DOM changes
 * @property {(url: string) => void} [navigate]   - SPA URL change
 */

/** @type {Map<string, FeatureDefinition>} */
const features = new Map();

export function registerFeature(definition) {
  if (!definition?.id || !definition.fields) {
    throw new Error('registerFeature: `id` and `fields` are required');
  }
  if (features.has(definition.id)) {
    throw new Error(`registerFeature: duplicate feature "${definition.id}"`);
  }
  features.set(definition.id, { order: 100, ...definition });
}

/** @returns {FeatureDefinition[]} features sorted by `order` */
export function getFeatures() {
  return [...features.values()].sort((a, b) => a.order - b.order);
}

/** Run one lifecycle hook on every feature; a failing feature never blocks the rest. */
export function runHook(hook, ...args) {
  for (const feature of getFeatures()) {
    const fn = feature[hook];
    if (typeof fn !== 'function') continue;
    try {
      fn(...args);
    } catch (error) {
      logError(Codes.FEATURE_HOOK, `feature "${feature.id}" ${hook}() failed`, { error });
    }
  }
}

/** Run one hook on a single feature, isolated like `runHook`. */
export function runFeatureHook(id, hook, ...args) {
  const fn = features.get(id)?.[hook];
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch (error) {
    logError(Codes.FEATURE_HOOK, `feature "${id}" ${hook}() failed`, { error });
  }
}
