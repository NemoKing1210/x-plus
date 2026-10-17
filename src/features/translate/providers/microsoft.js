import { gmRequest } from '../../../core/http.js';
import { toMicrosoftLang } from '../lang.js';

export async function translateWithMicrosoft(text, targetLang, config) {
  const apiKey = String(config.apiKey || '').trim();
  const region = String(config.region || 'global').trim() || 'global';
  if (!apiKey) throw new Error('missing-config');

  const to = encodeURIComponent(toMicrosoftLang(targetLang));
  const data = await gmRequest({
    method: 'POST',
    url: `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${to}`,
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/json',
    },
    data: [{ Text: text }],
    responseType: 'json',
  });

  const row = Array.isArray(data) ? data[0] : null;
  const translated = row?.translations?.[0]?.text;
  if (!translated) throw new Error('empty-result');

  return {
    text: translated,
    detectedSourceLang: row?.detectedLanguage?.language || null,
  };
}
