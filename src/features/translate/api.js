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

/**
 * Translate text via the configured provider.
 * @param {string} text
 * @param {string} targetLang
 * @returns {Promise<{ text: string, detectedSourceLang: string | null, fromCache: boolean, provider: string }>}
 */
export async function translateText(text, targetLang) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('empty');

  const providerId = isKnownProvider(cfg().provider) ? cfg().provider : 'google';
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
