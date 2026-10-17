import { gmRequest } from '../../../core/http.js';
import { toLibreLang } from '../lang.js';

function normalizeApiUrl(url) {
  const raw = String(url || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('missing-config');
  return raw;
}

export async function translateWithLibreTranslate(text, targetLang, config) {
  const apiUrl = normalizeApiUrl(config.apiUrl);
  const apiKey = String(config.apiKey || '').trim();

  const payload = {
    q: text,
    source: 'auto',
    target: toLibreLang(targetLang),
    format: 'text',
  };
  if (apiKey) payload.api_key = apiKey;

  const data = await gmRequest({
    method: 'POST',
    url: `${apiUrl}/translate`,
    headers: { 'Content-Type': 'application/json' },
    data: payload,
    responseType: 'json',
  });

  const translated = String(data?.translatedText || '').trim();
  if (!translated) throw new Error('empty-result');

  return {
    text: translated,
    detectedSourceLang: data.detectedLanguage?.language || null,
  };
}
