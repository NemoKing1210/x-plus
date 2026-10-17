import { normalizeHandle } from './handle.js';

export function normalizeLangCode(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

export function normalizeLangList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(normalizeLangCode).filter(Boolean))].sort();
}

export function normalizeHandleList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(normalizeHandle).filter(Boolean))].sort();
}
