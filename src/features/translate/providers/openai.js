import { gmRequest } from '../../../core/http.js';
import { languageDisplayName } from '../lang.js';

function normalizeBaseUrl(url) {
  const raw = String(url || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  return raw || 'https://api.openai.com/v1';
}

export async function translateWithOpenAI(text, targetLang, config) {
  const apiKey = String(config.apiKey || '').trim();
  if (!apiKey) throw new Error('missing-config');

  const model = String(config.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const langName = languageDisplayName(targetLang) || targetLang;

  const data = await gmRequest({
    method: 'POST',
    url: `${baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    data: {
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            `You are a translator. Translate the user message into ${langName} (${targetLang}). ` +
            'Reply with only the translation, no quotes or commentary.',
        },
        { role: 'user', content: text },
      ],
    },
    responseType: 'json',
  });

  const translated = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!translated) throw new Error('empty-result');

  return { text: translated, detectedSourceLang: null };
}
