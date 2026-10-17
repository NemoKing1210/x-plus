import { sanitizeFileName } from '../../utils/format.js';

/** Tokens understood by the file name template (documented in the settings UI). */
export const FILENAME_TOKENS = ['user', 'id', 'date', 'time', 'n', 'quality', 'type', 'text'];

const pad = (n) => String(n).padStart(2, '0');

/**
 * Expand `{token}` placeholders. Unknown tokens expand to nothing; the result
 * is sanitized for all file systems and never empty.
 *
 * @param {string} template
 * @param {{ user?: string, id?: string, createdAt?: string, n?: number, quality?: string, type?: string, text?: string }} context
 */
export function buildFileName(template, context) {
  const date = context.createdAt ? new Date(context.createdAt) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const values = {
    user: context.user || '',
    id: context.id || '',
    date: valid ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '',
    time: valid ? `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}` : '',
    n: context.n != null ? String(context.n) : '',
    quality: context.quality || '',
    type: context.type || '',
    text: String(context.text || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 40),
  };
  const expanded = String(template || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  return sanitizeFileName(expanded.replace(/[-_ ]{2,}/g, '-'), 120);
}
