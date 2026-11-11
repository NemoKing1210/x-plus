import { CACHE_SOFT_LIMIT_BYTES, TRANSLATION_CACHE_KEY } from '../../core/constants.js';
import { Codes, logWarn } from '../../core/debug.js';
import { getValue, setValue } from '../../core/storage.js';
import { cfg } from './config.js';

/** Max cache lifetime the settings UI allows, hours. */
export const CACHE_HOURS_MAX = 168;
const PERSIST_DEBOUNCE_MS = 400;

/** @type {Record<string, { value: unknown, at: number }> | null} */
let store = null;
let persistTimer = 0;
/** Set when the in-memory cache differs from what is in GM storage. */
let dirty = false;
/** Bumped on every mutation; memoizes usage numbers and eviction work. */
let revision = 0;
/** Sliding-TTL touches are flushed at most this often instead of on every read. */
const TOUCH_FLUSH_MS = 30000;
let touchTimer = 0;
/** @type {{ revision: number, usedBytes: number, entryCount: number }} */
let usage = { revision: -1, usedBytes: 0, entryCount: 0 };

export function readCacheStore() {
  if (store) return store;
  const raw = getValue(TRANSLATION_CACHE_KEY, null);
  store = raw && typeof raw === 'object' ? raw : {};
  return store;
}

function markDirty() {
  dirty = true;
  revision += 1;
}

export function cacheTtlMs(hours = cfg().cacheHours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, CACHE_HOURS_MAX) * 3600 * 1000;
}

function entryBytes(key, entry) {
  try {
    return (JSON.stringify(key).length + JSON.stringify(entry).length) * 2;
  } catch {
    return 0;
  }
}

export function pruneExpiredCache() {
  const map = readCacheStore();
  const ttl = cacheTtlMs();
  if (ttl <= 0) {
    if (Object.keys(map).length) {
      for (const key of Object.keys(map)) delete map[key];
      markDirty();
    }
    return;
  }
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of Object.entries(map)) {
    if (!entry || typeof entry !== 'object' || now - (entry.at || 0) > ttl) {
      delete map[key];
      removed += 1;
    }
  }
  if (removed) markDirty();
}

/**
 * Evict the oldest entries until the cache fits the soft budget. Sizes are
 * summed once and kept up to date per deletion: the old version serialized the
 * whole map after every removed entry (quadratic on a full cache).
 */
export function evictCacheToBudget() {
  const map = readCacheStore();
  const entries = Object.entries(map);
  let total = 0;
  for (const [key, entry] of entries) total += entryBytes(key, entry);
  if (total <= CACHE_SOFT_LIMIT_BYTES) return;

  entries.sort((a, b) => (a[1]?.at || 0) - (b[1]?.at || 0));
  const target = CACHE_SOFT_LIMIT_BYTES * 0.85;
  let removed = 0;
  for (const [key, entry] of entries) {
    total -= entryBytes(key, entry);
    delete map[key];
    removed += 1;
    if (total <= target) break;
  }
  if (removed) markDirty();
}

/** Write the cache to GM storage right away (page hide, explicit flush). */
export function persistCacheNow() {
  clearTimeout(persistTimer);
  persistTimer = 0;
  if (!store || !dirty) return;
  pruneExpiredCache();
  evictCacheToBudget();
  if (setValue(TRANSLATION_CACHE_KEY, store)) {
    dirty = false;
    // The write already contains any sliding-TTL touches.
    clearTimeout(touchTimer);
    touchTimer = 0;
  } else {
    logWarn(Codes.TRANSLATE_CACHE, 'failed to persist the translation cache');
  }
}

export function persistCacheSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistCacheNow, PERSIST_DEBOUNCE_MS);
}

export function getCached(key) {
  const map = readCacheStore();
  const entry = map[key];
  if (!entry || typeof entry !== 'object') return null;
  const ttl = cacheTtlMs();
  if (ttl <= 0) return null;
  if (Date.now() - (entry.at || 0) > ttl) {
    delete map[key];
    markDirty();
    persistCacheSoon();
    return null;
  }
  // Sliding TTL: keep the touch in memory and flush it in a batch. Persisting
  // on every cache hit rewrote the whole store for each translated post.
  entry.at = Date.now();
  if (!touchTimer) {
    touchTimer = setTimeout(() => {
      touchTimer = 0;
      dirty = true;
      persistCacheSoon();
    }, TOUCH_FLUSH_MS);
  }
  return entry.value;
}

export function setCached(key, value) {
  if (cacheTtlMs() <= 0) return;
  readCacheStore()[key] = { value, at: Date.now() };
  markDirty();
  persistCacheSoon();
}

export function clearCache() {
  store = {};
  clearTimeout(persistTimer);
  clearTimeout(touchTimer);
  persistTimer = 0;
  touchTimer = 0;
  dirty = false;
  markDirty();
  if (setValue(TRANSLATION_CACHE_KEY, {})) dirty = false;
}

/**
 * Usage numbers for the settings meter. `hoursOverride` previews an unsaved
 * TTL from the settings draft.
 */
export function getCacheUsageStats(hoursOverride) {
  const map = readCacheStore();
  if (usage.revision !== revision) {
    let usedBytes = 0;
    let entryCount = 0;
    for (const key of Object.keys(map)) {
      usedBytes += entryBytes(key, map[key]);
      entryCount += 1;
    }
    usage = { revision, usedBytes, entryCount };
  }
  const { usedBytes, entryCount } = usage;
  const limitBytes = CACHE_SOFT_LIMIT_BYTES;
  const hours = Number(hoursOverride ?? cfg().cacheHours);
  const enabled = Number.isFinite(hours) && hours > 0;
  return {
    usedBytes,
    freeBytes: Math.max(0, limitBytes - usedBytes),
    limitBytes,
    entryCount,
    pct: limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0,
    ttlHours: enabled ? Math.min(hours, CACHE_HOURS_MAX) : 0,
    enabled,
  };
}

/** @returns {'ok'|'warn'|'high'|'off'} soft fill level for colouring */
export function cacheFillLevel(stats = getCacheUsageStats()) {
  if (!stats.enabled) return 'off';
  if (stats.pct >= 85) return 'high';
  if (stats.pct >= 60) return 'warn';
  return 'ok';
}
