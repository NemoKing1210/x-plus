/**
 * Capability resolver.
 *
 * A feature asks for a capability (`getPostText(article)`); the resolver
 * decides which profile answers. The profile that discovered an element owns
 * it, so an owned element's negative answer (`null`, `false`, `[]`) is final
 * and never falls through to a profile that might guess differently.
 *
 * See `DOM compatibility` in docs/ARCHITECTURE.md (capability kinds, ownership
 * and fallback order).
 */

import { kindOf } from './kinds.js';

function isElement(value) {
  return Boolean(value && value.nodeType === 1);
}

function asArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value[Symbol.iterator] === 'function') return [...value];
  return [value];
}

function classify(value, owned) {
  if (value === undefined) return 'empty';
  if (value === null || value === false) return owned ? 'definitive' : 'empty';
  if (Array.isArray(value) || (typeof value === 'object' && typeof value.length === 'number')) {
    return value.length === 0 ? (owned ? 'definitive' : 'empty') : 'ok';
  }
  return 'ok';
}

/**
 * Remove exact duplicates, then nodes nested inside another node of the same
 * result. Quote text roots are siblings of the post text root, not nested, so
 * they survive.
 *
 * @param {Element[]} list
 * @returns {Element[]}
 */
export function dedupeElements(list) {
  const unique = [...new Set(list)];
  return unique.filter((el) => !unique.some((other) => other !== el && other.contains?.(el)));
}

/**
 * Remove exact duplicates from an element-list answer. List items may be
 * elements or containers with an `el` field (`getMediaHosts` returns the
 * latter), so identity is compared on the element, not on the wrapper.
 *
 * @param {Array<Element|{ el?: Element }>} list
 * @returns {Array<Element|{ el?: Element }>}
 */
function dedupeItems(list) {
  const seen = new Set();
  const unique = [];
  for (const item of list) {
    const element = isElement(item) ? item : item?.el;
    if (element) {
      if (seen.has(element)) continue;
      seen.add(element);
    }
    unique.push(item);
  }
  return unique;
}

function units(value) {
  // `false` is a negative answer like `null`: an owned element may gain its
  // target later, so it must not be cached as a definitive "no".
  if (value == null || value === false) return 0;
  if (Array.isArray(value) || typeof value.length === 'number') return value.length;
  return 1;
}

/**
 * @param {{
 *   profiles: Array<{ id: string, api: Record<string, Function>, detect?: Function, css?: object }>,
 *   report: ReturnType<import('./report.js').createReport>,
 *   logger?: { miss?: Function, fallback?: Function, error?: Function },
 * }} options
 */
export function createResolver({ profiles, report, logger = {} }) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error('createResolver requires at least one profile');
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  let owners = new WeakMap();
  let cache = new WeakMap();
  let activeId = profiles[0].id;

  function setActive(id) {
    if (!profileById.has(id)) throw new Error(`unknown profile: ${id}`);
    activeId = id;
  }

  function activeIdValue() {
    return activeId;
  }

  function clearOwners() {
    owners = new WeakMap();
    cache = new WeakMap();
  }

  function snapshot() {
    return { ...report.snapshot(), active: activeId };
  }

  function reportError(profileId, key, error) {
    report.error(profileId, key, error);
    logger.error?.(profileId, key, error);
  }

  function registerOwners(value, profileId) {
    const register = (element) => {
      if (isElement(element) && !owners.has(element)) owners.set(element, profileId);
    };
    if (Array.isArray(value)) {
      value.forEach(register);
      return;
    }
    register(value);
    if (value && typeof value === 'object') {
      for (const field of ['el', 'row', 'before', 'template']) register(value[field]);
    }
  }

  function cacheable(kind, input, ownedId) {
    return (
      (kind === 'element-single' || kind === 'element-list') &&
      isElement(input) &&
      input.isConnected !== false &&
      Boolean(ownedId)
    );
  }

  function readCache(input, key) {
    const perKey = cache.get(input);
    return perKey?.has(key) ? perKey.get(key) : undefined;
  }

  function deleteCache(input, key) {
    cache.get(input)?.delete(key);
  }

  /**
   * Whether a cached answer still describes the page. X re-renders a post header
   * in place without a navigation (owners are not cleared), so an answer can name
   * a row that was replaced: inserting into it would throw or never show.
   * A slot's anchor must still be a child of its row for the same reason.
   */
  function cacheValid(value) {
    if (value == null) return true;
    if (Array.isArray(value)) return value.every(cacheValid);
    if (isElement(value)) return value.isConnected !== false;
    if (typeof value !== 'object') return true;
    for (const field of ['el', 'row', 'before', 'template']) {
      const element = value[field];
      if (element == null) continue;
      if (!isElement(element) || element.isConnected === false) return false;
    }
    if (isElement(value.row) && isElement(value.before) && value.before.parentElement !== value.row) return false;
    return true;
  }

  function writeCache(input, key, value) {
    let perKey = cache.get(input);
    if (!perKey) {
      perKey = new Map();
      cache.set(input, perKey);
    }
    perKey.set(key, { value });
    return value;
  }

  /**
   * Cache a positive answer only. A negative answer (`null`, `[]`) is final for
   * one call, but the page can still grow the element later — X mounts the
   * native translate bar after a click and media after a lazy load — so keeping
   * it would hide every later answer until the next navigation.
   */
  function cacheAnswer(input, key, value) {
    if (input && units(value) > 0) writeCache(input, key, value);
    return value;
  }

  function resolvePredicate(key, args, order, ownedId) {
    let owned = Boolean(ownedId && profileById.has(ownedId));

    for (const profile of order) {
      const ownedForThis = owned && profile.id === ownedId;
      if (typeof profile.api[key] !== 'function') {
        if (ownedForThis) owned = false;
        continue;
      }
      let value;
      try {
        value = profile.api[key](...args);
      } catch (error) {
        reportError(profile.id, key, error);
        if (ownedForThis) owned = false;
        continue;
      }

      if (value === undefined) {
        if (ownedForThis) owned = false;
        continue;
      }
      if (value === null || value === false) {
        if (ownedForThis) return false;
        continue;
      }

      report.hit(profile.id, key);
      if (!ownedForThis && profile.id !== activeId) {
        if (report.fallback(profile.id, key)) logger.fallback?.(profile.id, key);
      }
      return Boolean(value);
    }

    return false;
  }

  function resolve(key, args = []) {
    const kind = kindOf(key);
    const input = args[0];
    const connected = isElement(input) ? input.isConnected !== false : false;
    const ownedId = connected ? owners.get(input) || null : null;
    const cacheKey = cacheable(kind, input, ownedId) ? input : null;

    if (cacheKey) {
      const cached = readCache(cacheKey, key);
      if (cached !== undefined) {
        if (cacheValid(cached.value)) return cached.value;
        deleteCache(cacheKey, key);
      }
    }

    const owner = ownedId ? profileById.get(ownedId) : null;
    const others = profiles.filter((profile) => profile.id !== activeId);
    const order = owner ? [owner, ...profiles.filter((profile) => profile.id !== owner.id)] : [profileById.get(activeId), ...others];

    if (kind === 'predicate') {
      return resolvePredicate(key, args, order, ownedId);
    }

    const found = [];
    let owned = Boolean(owner);

    for (const profile of order) {
      const ownedForThis = owned && profile.id === ownedId;
      if (typeof profile.api[key] !== 'function') {
        if (ownedForThis) owned = false;
        continue;
      }
      let value;
      try {
        value = profile.api[key](...args);
      } catch (error) {
        reportError(profile.id, key, error);
        if (ownedForThis) owned = false;
        continue;
      }

      const outcome = classify(value, ownedForThis);

      if (outcome === 'definitive') {
        const result = kind === 'page-list' ? asArray(value) : value;
        registerOwners(result, profile.id);
        return cacheAnswer(cacheKey, key, result);
      }

      if (outcome === 'empty') {
        if (ownedForThis) owned = false;
        continue;
      }

      report.hit(profile.id, key);

      if (kind === 'page-list') {
        for (const item of asArray(value)) {
          found.push(item);
          registerOwners(item, profile.id);
        }
        continue;
      }

      if (kind === 'element-list') {
        const items = asArray(value);
        for (const item of items) registerOwners(item, profile.id);
        if (!ownedForThis && profile.id !== activeId) {
          if (report.fallback(profile.id, key)) logger.fallback?.(profile.id, key);
        }
        // An element-list is owned by one profile: the first answer wins and
        // nothing is merged in from the other generation.
        return cacheAnswer(cacheKey, key, dedupeItems(items));
      }

      registerOwners(value, profile.id);
      if (!ownedForThis && profile.id !== activeId) {
        if (report.fallback(profile.id, key)) logger.fallback?.(profile.id, key);
      }
      return cacheAnswer(cacheKey, key, value);
    }

    if (found.length) {
      const result = dedupeElements(found);
      if (result.length) return result;
    }

    if (kind === 'page-single' || kind === 'element-single') {
      if (report.miss(key)) logger.miss?.(key);
      return null;
    }

    return [];
  }

  return {
    setActive,
    activeId: activeIdValue,
    resolve,
    clearOwners,
    snapshot,
  };
}
