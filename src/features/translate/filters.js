import { updateFeatureSettings } from '../../core/settings.js';
import { normalizeHandle } from '../../utils/handle.js';
import { normalizeHandleList, normalizeLangCode, normalizeLangList } from '../../utils/lists.js';
import { cfg } from './config.js';

export function getAccountBlocklist() {
  return normalizeHandleList(cfg().accountBlocklist);
}

export function isAccountBlocked(handle) {
  const h = normalizeHandle(handle);
  if (!h) return false;
  return getAccountBlocklist().includes(h);
}

function persistBlocklist(list) {
  updateFeatureSettings('translate', { accountBlocklist: normalizeHandleList(list) });
}

export function addAccountBlocklistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  const list = getAccountBlocklist();
  if (list.includes(h)) return { ok: false, reason: 'exists', handle: h };
  persistBlocklist([...list, h]);
  return { ok: true, handle: h, added: true };
}

function removeAccountBlocklistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  persistBlocklist(getAccountBlocklist().filter((item) => item !== h));
  return { ok: true, handle: h, removed: true };
}

export function toggleAccountBlocklistHandle(handle) {
  if (isAccountBlocked(handle)) {
    return { ...removeAccountBlocklistHandle(handle), added: false };
  }
  return addAccountBlocklistHandle(handle);
}

/** Whether `detected` matches any code in `list` (prefix-aware). */
export function isLangInList(detected, list) {
  const d = normalizeLangCode(detected);
  if (!d || !Array.isArray(list) || !list.length) return false;
  return list.some((item) => {
    const l = normalizeLangCode(item);
    if (!l) return false;
    return d === l || d.startsWith(`${l}-`);
  });
}

/**
 * @param {string | null | undefined} detected
 * @returns {'blocked' | 'not-allowed' | null}
 */
export function getLanguageSkipReason(detected) {
  if (!detected) return null;
  const block = normalizeLangList(cfg().langBlocklist);
  if (isLangInList(detected, block)) return 'blocked';
  const allow = normalizeLangList(cfg().langAllowlist);
  if (allow.length && !isLangInList(detected, allow)) return 'not-allowed';
  return null;
}
