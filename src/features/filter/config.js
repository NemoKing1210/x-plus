import { field } from '../../core/schema.js';
import { normalizeHandle } from '../../utils/handle.js';

/**
 * Condition catalog — the single source of truth for the filter: the schema,
 * the settings UI, the matcher and the i18n key check all read it.
 *
 * `value` is 'text' | 'handle' | 'lang' (free input kinds) or an enum array.
 * An operator or enum value that is not valid for its field is blanked during
 * normalization, which makes the condition incomplete instead of broad.
 */

export const LIMITS = Object.freeze({ rules: 50, conditions: 20, name: 60, value: 500 });

export const TEXT_OPS = Object.freeze([
  'contains',
  'notContains',
  'word',
  'notWord',
  'startsWith',
  'endsWith',
  'equals',
  'notEquals',
  'empty',
  'notEmpty',
  'regex',
  'notRegex',
]);

export const FIELDS = Object.freeze({
  authorName: { ops: TEXT_OPS, value: 'text' },
  handle: { ops: TEXT_OPS, value: 'handle' },
  text: { ops: TEXT_OPS, value: 'text' },
  lang: { ops: Object.freeze(['is', 'isNot']), value: 'lang' },
  media: {
    ops: Object.freeze(['has', 'hasNot']),
    value: Object.freeze(['any', 'photo', 'video']),
  },
  attachment: {
    ops: Object.freeze(['has', 'hasNot']),
    value: Object.freeze(['link', 'quote', 'poll', 'article']),
  },
  meta: {
    ops: Object.freeze(['is', 'isNot']),
    value: Object.freeze(['promoted', 'verified', 'context']),
  },
});

export const FIELD_NAMES = Object.freeze(Object.keys(FIELDS));

/** `empty` / `notEmpty` are the only text operators without a value. */
export const takesValue = (op) => op !== 'empty' && op !== 'notEmpty';

const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

const conditionFields = {
  field: field.enum(FIELD_NAMES, 'text'),
  op: field.text('contains', { max: 20 }),
  value: field.text('', { max: LIMITS.value, trim: false }),
};

const ruleFields = {
  id: field.text('', { max: 40 }),
  name: field.text('', { max: LIMITS.name }),
  enabled: field.bool(true),
  match: field.enum(['all', 'any'], 'all'),
  conditions: field.records(conditionFields, {
    max: LIMITS.conditions,
    idKey: null,
    sanitizeItem: sanitizeCondition,
  }),
};

export const filterFields = {
  enabled: field.bool(false),
  rules: field.records(ruleFields, { max: LIMITS.rules, idPrefix: 'r' }),
};

/** Cross-field cleanup after schema normalization (function declarations hoist). */
export function sanitizeCondition(item) {
  const spec = FIELDS[item.field];
  if (!spec || !spec.ops.includes(item.op)) item.op = '';
  if (!takesValue(item.op)) item.value = '';
  else if (spec?.value === 'lang') {
    const lang = String(item.value || '').trim().toLowerCase();
    item.value = LANG_RE.test(lang) ? lang : '';
  } else if (spec?.value === 'handle') {
    item.value = normalizeHandle(item.value);
  } else if (Array.isArray(spec?.value) && !spec.value.includes(item.value)) {
    item.value = '';
  }
  return item;
}

export function newCondition() {
  return { field: 'text', op: 'contains', value: '' };
}

let ruleSeq = 0;
export function newRule() {
  ruleSeq += 1;
  return {
    id: `r-${Date.now().toString(36)}${ruleSeq.toString(36)}${Math.random()
      .toString(36)
      .slice(2, 5)}`.slice(0, 40),
    name: '',
    enabled: true,
    match: 'all',
    conditions: [newCondition()],
  };
}
