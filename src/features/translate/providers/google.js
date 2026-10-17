import { gmRequest } from '../../../core/http.js';

/** Google Translate free endpoint (no API key). */
const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

export async function translateWithGoogle(text, targetLang) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'auto',
    tl: targetLang,
    dt: 't',
    q: text,
  });
  const data = await gmRequest({
    method: 'GET',
    url: `${GOOGLE_TRANSLATE_URL}?${params.toString()}`,
    responseType: 'json',
    anonymous: true,
  });

  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = segments
    .map((part) => (Array.isArray(part) ? part[0] : ''))
    .filter(Boolean)
    .join('');

  if (!translated) throw new Error('empty-result');

  const detectedSourceLang =
    typeof data?.[2] === 'string'
      ? data[2]
      : typeof data?.[8]?.[0]?.[0] === 'string'
        ? data[8][0][0]
        : null;

  return { text: translated, detectedSourceLang };
}
