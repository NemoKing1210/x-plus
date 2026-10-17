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

export function readCacheStore() {
  if (store) return store;
  const raw = getValue(TRANSLATION_CACHE_KEY, null);
  store = raw && typeof raw === 'object' ? raw : {};
  return store;
}

export function cacheTtlMs(hours = cfg().cacheHours) {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, CACHE_HOURS_MAX) * 3600 * 1000;
}

function approxBytes(map) {
  try {
    return JSON.stringify(map).length * 2;
  } catch {
    return 0;
  }
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
    for (const key of Object.keys(map)) delete map[key];
    return;
  }
  const now = Date.now();
  for (const [key, entry] of Object.entries(map)) {
    if (!entry || typeof entry !== 'object' || now - (entry.at || 0) > ttl) delete map[key];
  }
}

/** Evict the oldest entries until the cache fits the soft budget. */
export function evictCacheToBudget() {
  const map = readCacheStore();
  if (approxBytes(map) <= CACHE_SOFT_LIMIT_BYTES) return;
  const oldestFirst = Object.entries(map).sort((a, b) => (a[1]?.at || 0) - (b[1]?.at || 0));
  for (const [key] of oldestFirst) {
    delete map[key];
    if (approxBytes(map) <= CACHE_SOFT_LIMIT_BYTES * 0.85) break;
  }
}

/** Write the cache to GM storage right away (page hide, explicit flush). */
export function persistCacheNow() {
  clearTimeout(persistTimer);
  if (!store) return;
  pruneExpiredCache();
  evictCacheToBudget();
  if (!setValue(TRANSLATION_CACHE_KEY, store)) {
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
    persistCacheSoon();
    return null;
  }
  entry.at = Date.now();
  persistCacheSoon();
  return entry.value;
}

export function setCached(key, value) {
  if (cacheTtlMs() <= 0) return;
  readCacheStore()[key] = { value, at: Date.now() };
  persistCacheSoon();
}

export function clearCache() {
  store = {};
  clearTimeout(persistTimer);
  setValue(TRANSLATION_CACHE_KEY, {});
}

/**
 * Usage numbers for the settings meter. `hoursOverride` previews an unsaved
 * TTL from the settings draft.
 */
export function getCacheUsageStats(hoursOverride) {
  const map = readCacheStore();
  let usedBytes = 0;
  let entryCount = 0;
  for (const key of Object.keys(map)) {
    usedBytes += entryBytes(key, map[key]);
    entryCount += 1;
  }
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
