/**
 * Diagnostic counters for the compatibility resolver.
 *
 * `snapshot()` is what `window.__xpCompat.report()` and the harness panel
 * render; `resetForNavigation()` keeps the report scoped to the current SPA
 * route instead of growing forever.
 */

export function createReport() {
  const hits = new Map();
  const fallbacks = new Map();
  const misses = new Set();
  const errors = [];

  return {
    generation: 'unknown',
    xBuild: '',
    active: 'unknown',

    hit(profileId, key) {
      if (!hits.has(profileId)) hits.set(profileId, new Set());
      hits.get(profileId).add(key);
    },

    /** @returns {boolean} true the first time this key falls back to this profile. */
    fallback(profileId, key) {
      const isNew = fallbacks.get(key) !== profileId;
      fallbacks.set(key, profileId);
      return isNew;
    },

    /** @returns {boolean} true the first time this key misses. */
    miss(key) {
      const isNew = !misses.has(key);
      misses.add(key);
      return isNew;
    },

    error(profileId, key, error) {
      errors.push({ profileId, key, message: String(error?.message || error) });
    },

    resetForNavigation() {
      hits.clear();
      fallbacks.clear();
      misses.clear();
      errors.length = 0;
    },

    snapshot() {
      return {
        generation: this.generation,
        xBuild: this.xBuild,
        active: this.active,
        hits: Object.fromEntries([...hits].map(([id, set]) => [id, [...set]])),
        fallbacks: Object.fromEntries(fallbacks),
        misses: [...misses],
        errors: [...errors],
      };
    },
  };
}
