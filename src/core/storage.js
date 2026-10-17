import { GM_getValue, GM_setValue } from '$';

/** Safe GM storage access: managers differ and storage can be unavailable. */
export function getValue(key, fallback = null) {
  try {
    const value = GM_getValue(key, fallback);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

/** @returns {boolean} whether the value was persisted */
export function setValue(key, value) {
  try {
    GM_setValue(key, value);
    return true;
  } catch {
    return false;
  }
}
