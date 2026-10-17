import { gmRequest } from '../../../core/http.js';
import { toDeepLLang } from '../lang.js';

export async function translateWithDeepL(text, targetLang, config) {
  const apiKey = String(config.apiKey || '').trim();
  if (!apiKey) throw new Error('missing-config');

  const plan = config.plan === 'pro' ? 'pro' : 'free';
  const host = plan === 'pro' ? 'api.deepl.com' : 'api-free.deepl.com';
  const body = new URLSearchParams({
    text,
    target_lang: toDeepLLang(targetLang),
  });

  const data = await gmRequest({
    method: 'POST',
    url: `https://${host}/v2/translate`,
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: body.toString(),
    responseType: 'json',
  });

  const translated = data?.translations?.[0]?.text;
  if (!translated) throw new Error('empty-result');

  return {
    text: translated,
    detectedSourceLang: data.translations[0].detected_source_language || null,
  };
}
