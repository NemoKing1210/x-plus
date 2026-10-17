import { updateFeatureSettings } from '../../core/settings.js';
import { normalizeHandle } from '../../utils/handle.js';
import { cfg } from './config.js';
import { isAccountBlocked } from './filters.js';

export function getAutoAllowlist() {
  return Array.isArray(cfg().autoAllowlist) ? [...cfg().autoAllowlist] : [];
}

export function isInAutoAllowlist(handle) {
  const h = normalizeHandle(handle);
  if (!h) return false;
  return getAutoAllowlist().includes(h);
}

function persist(list) {
  updateFeatureSettings('translate', {
    autoAllowlist: [...new Set(list.map(normalizeHandle).filter(Boolean))].sort(),
  });
}

export function addAutoAllowlistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  const list = getAutoAllowlist();
  if (list.includes(h)) return { ok: false, reason: 'exists', handle: h };
  persist([...list, h]);
  return { ok: true, handle: h, added: true };
}

function removeAutoAllowlistHandle(handle) {
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'invalid' };
  persist(getAutoAllowlist().filter((item) => item !== h));
  return { ok: true, handle: h, removed: true };
}

export function toggleAutoAllowlistHandle(handle) {
  if (isInAutoAllowlist(handle)) {
    return { ...removeAutoAllowlistHandle(handle), added: false };
  }
  return addAutoAllowlistHandle(handle);
}

/** Whether this author is eligible for automatic translation. */
export function isAutoTranslateAllowedForHandle(handle) {
  const config = cfg();
  if (config.translateMode !== 'auto') return false;
  if (isAccountBlocked(handle)) return false;
  if (config.autoScope !== 'allowlist') return true;
  return isInAutoAllowlist(handle);
}
