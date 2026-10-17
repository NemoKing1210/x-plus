import { normalizeHandle } from '../utils/handle.js';
import { normalizeLangCode } from '../utils/lists.js';

/**
 * Declarative settings schema.
 *
 * A feature describes its settings once with these field builders; the same
 * description yields the defaults, the normalizer applied on every load /
 * save / import, and (together with a tab spec) the settings UI. Unknown
 * keys are dropped and invalid values fall back to the default, so a stored
 * or imported blob can never put the script into an invalid state.
 */

const LIST_KINDS = {
  handle: normalizeHandle,
  lang: normalizeLangCode,
  text: (value) => String(value ?? '').trim(),
};

export const field = {
  /** @param {boolean} [def] */
  bool: (def = false) => ({ type: 'bool', default: def }),

  /**
   * @param {readonly string[] | (() => readonly string[])} values
   * @param {string} def
   */
  enum: (values, def) => ({ type: 'enum', values, default: def }),

  /** @param {number} def @param {{min?: number, max?: number}} [range] */
  int: (def, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => ({
    type: 'int',
    default: def,
    min,
    max,
  }),

  /** @param {string} [def] @param {{max?: number, trim?: boolean}} [opts] */
  text: (def = '', { max = 500, trim = true } = {}) => ({
    type: 'text',
    default: def,
    max,
    trim,
  }),

  /**
   * Deduplicated list of normalized items.
   * @param {'handle'|'lang'|'text'} kind
   */
  list: (kind, def = [], { max = 500, sort = true } = {}) => ({
    type: 'list',
    kind,
    default: def,
    max,
    sort,
  }),

  /** Nested object with its own field map. */
  record: (fields) => ({ type: 'record', fields }),
};

function enumValues(spec) {
  return typeof spec.values === 'function' ? spec.values() : spec.values;
}

/** Default value of one field (deep-cloned). */
export function defaultOf(spec) {
  if (spec.type === 'record') return defaultsOf(spec.fields);
  if (spec.type === 'list') return [...spec.default];
  return spec.default;
}

/** Default values of a field map. */
export function defaultsOf(fields) {
  const out = {};
  for (const [key, spec] of Object.entries(fields)) out[key] = defaultOf(spec);
  return out;
}

/** Normalize one raw value against its field spec. */
export function normalizeField(spec, raw) {
  switch (spec.type) {
    case 'bool':
      return typeof raw === 'boolean' ? raw : spec.default;
    case 'enum':
      return enumValues(spec).includes(raw) ? raw : spec.default;
    case 'int': {
      const n = Number(raw);
      if (raw === '' || raw == null || !Number.isFinite(n)) return spec.default;
      return Math.min(spec.max, Math.max(spec.min, Math.round(n)));
    }
    case 'text': {
      if (typeof raw !== 'string') return spec.default;
      const value = spec.trim ? raw.trim() : raw;
      return value.slice(0, spec.max);
    }
    case 'list': {
      if (!Array.isArray(raw)) return [...spec.default];
      const normalize = LIST_KINDS[spec.kind] || LIST_KINDS.text;
      const items = [...new Set(raw.map(normalize).filter(Boolean))].slice(0, spec.max);
      return spec.sort ? items.sort() : items;
    }
    case 'record':
      return normalizeFields(spec.fields, raw);
    default:
      return spec.default;
  }
}

/** Normalize a raw object against a field map (unknown keys are dropped). */
export function normalizeFields(fields, raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [key, spec] of Object.entries(fields)) {
    out[key] = normalizeField(spec, source[key]);
  }
  return out;
}

/** Read a dotted path (`providerConfig.deepl.apiKey`) from an object. */
export function getPath(object, path) {
  let node = object;
  for (const part of path.split('.')) {
    if (node == null) return undefined;
    node = node[part];
  }
  return node;
}

/** Write a dotted path, creating intermediate objects when missing. */
export function setPath(object, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let node = object;
  for (const part of parts) {
    if (node[part] == null || typeof node[part] !== 'object') node[part] = {};
    node = node[part];
  }
  node[last] = value;
}
