import { getCached, setCached } from './cache.js';
import { cfg } from './config.js';
import { translateWithDeepL } from './providers/deepl.js';
import { translateWithGoogle } from './providers/google.js';
import { translateWithLibreTranslate } from './providers/libretranslate.js';
import { translateWithMicrosoft } from './providers/microsoft.js';
import { translateWithOpenAI } from './providers/openai.js';
import { isKnownProvider } from './providers/registry.js';
import { translateWithYandex } from './providers/yandex.js';

/** Identical in-flight requests share one promise. */
const inflight = new Map();

/**
 * Translations fetched ahead of time (Shorts mode: the next post). They live in
 * memory for a few minutes whether or not the persistent cache is on, and are
 * handed out once, to whoever asks for exactly that text.
 */
const WARM_TTL_MS = 5 * 60 * 1000;
const WARM_MAX = 16;
const warm = new Map();

function takeWarm(key) {
  const entry = warm.get(key);
  if (!entry) return null;
  warm.delete(key);
  return Date.now() - entry.at < WARM_TTL_MS ? entry.result : null;
}

function rememberWarm(key, result) {
  warm.set(key, { result, at: Date.now() });
  while (warm.size > WARM_MAX) warm.delete(warm.keys().next().value);
}

function cacheKey(providerId, text, targetLang) {
  return `tr:${providerId}:${targetLang}:${text}`;
}

function providerConfig(providerId) {
  const config = cfg().providerConfig?.[providerId];
  return config && typeof config === 'object' ? config : {};
}

function callProvider(providerId, text, targetLang) {
  const config = providerConfig(providerId);
  switch (providerId) {
    case 'deepl':
      return translateWithDeepL(text, targetLang, config);
    case 'microsoft':
      return translateWithMicrosoft(text, targetLang, config);
    case 'openai':
      return translateWithOpenAI(text, targetLang, config);
    case 'yandex':
      return translateWithYandex(text, targetLang, config);
    case 'libretranslate':
      return translateWithLibreTranslate(text, targetLang, config);
    case 'google':
    default:
      return translateWithGoogle(text, targetLang);
  }
}

function currentProvider() {
  return isKnownProvider(cfg().provider) ? cfg().provider : 'google';
}

/** Whether a translation of exactly this text is already at hand (cache or fetched ahead). */
export function hasTranslation(text, targetLang) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  const key = cacheKey(currentProvider(), trimmed, targetLang);
  const hit = getCached(key);
  if (hit && typeof hit === 'object' && hit.text) return true;
  const entry = warm.get(key);
  return Boolean(entry) && Date.now() - entry.at < WARM_TTL_MS;
}

/**
 * Fetch a translation now, to be used later: it is kept ready (see `warm`) and
 * nothing is shown. Quiet on failure; a post that is not wanted costs nothing more.
 */
export async function prefetchTranslation(text, targetLang) {
  const trimmed = String(text || '').trim();
  if (!trimmed || hasTranslation(trimmed, targetLang)) return;
  const key = cacheKey(currentProvider(), trimmed, targetLang);
  if (inflight.has(key)) return;
  try {
    // translateText stores into the persistent cache itself (when it is on) and
    // consumes warm entries, so keep the result for exactly one later use.
    const result = await translateText(trimmed, targetLang);
    rememberWarm(key, result);
  } catch {
    /* the real request will report its own error */
  }
}

/**
 * Translate text via the configured provider.
 * @param {string} text
 * @param {string} targetLang
 * @returns {Promise<{ text: string, detectedSourceLang: string | null, fromCache: boolean, provider: string }>}
 */
export async function translateText(text, targetLang) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty');

  const providerId = currentProvider();
  const key = cacheKey(providerId, trimmed, targetLang);

  const hit = getCached(key);
  if (hit && typeof hit === 'object' && hit.text) {
    return {
      text: hit.text,
      detectedSourceLang: hit.detectedSourceLang || null,
      fromCache: true,
      provider: providerId,
    };
  }

  const warmed = takeWarm(key);
  if (warmed) return { ...warmed, fromCache: false };

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const raw = await callProvider(providerId, trimmed, targetLang);
    const result = {
      text: raw.text,
      detectedSourceLang: raw.detectedSourceLang || null,
      fromCache: false,
      provider: providerId,
    };
    setCached(key, { text: result.text, detectedSourceLang: result.detectedSourceLang });
    return result;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
