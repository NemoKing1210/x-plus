import { gmRequest } from '../../../core/http.js';
import { toYandexLang } from '../lang.js';

export async function translateWithYandex(text, targetLang, config) {
  const apiKey = String(config.apiKey || '').trim();
  const folderId = String(config.folderId || '').trim();
  if (!apiKey || !folderId) throw new Error('missing-config');

  const data = await gmRequest({
    method: 'POST',
    url: 'https://translate.api.cloud.yandex.net/translate/v2/translate',
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      folderId,
      texts: [text],
      targetLanguageCode: toYandexLang(targetLang),
    },
    responseType: 'json',
  });

  const translated = data?.translations?.[0]?.text;
  if (!translated) throw new Error('empty-result');

  return {
    text: translated,
    detectedSourceLang: data.translations[0].detectedLanguageCode || null,
  };
}
