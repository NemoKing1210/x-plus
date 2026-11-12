# Post Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live, user-built post filter: named rules of one-level conditions combined with AND/OR, evaluated against posts and hiding the whole timeline cell.

**Architecture:** A new independent feature (`src/features/filter/`) mirrors the proven per-post observer in `interface/engine.js`: one `MutationObserver`, a dirty-article queue, synchronous marking before paint, and marks taken back when X recycles cells. Storage goes through a new `field.records` schema type, so load/save/import/reset all normalize user rules. A custom settings tab renders the rule builder.

**Tech Stack:** Vanilla ES modules, Vite, `vite-plugin-monkey`, Node's `node:test`, flat i18n maps.

**Spec:** `docs/superpowers/specs/2026-11-12-post-filter-design.md`

## Global Constraints

- No frameworks, no TypeScript (AGENTS.md, spec).
- Settings only through `core/schema.js`; never call `GM_getValue` / `GM_setValue` directly.
- Feature prefix `xp-` / `data-xp-` / `xp_`; UI through `el()`; colors from `var(--xp-*)`.
- All 8 locales (`en`, `ru`, `zh`, `es`, `pt`, `de`, `fr`, `ja`) must have every used key.
- Never hand-edit `x-plus.user.js` / `x-plus.meta.js`; `npm run build` generates them.
- `interface` may only gain `export` keywords on `isPromotedArticle` and `quoteCardOf`; no behavior changes there.
- Commits follow Conventional Commits; no co-author trailer (owner rule). Commit steps below are part of the owner-approved plan.
- Feature off by default; no observer and no work when off.
- Caps: 50 rules, 20 conditions per rule, name 60, value 500, id 40 chars.

## Review Focus

- **Emoji / flag in an author name or post text.** X renders flags as `<img alt="🇺🇦">`; `textContent` omits them, so a rule "name contains 🇺🇦" must still match. Pinned by the `plainText` walker in Task 4 and a manual harness check.
- **An imported or stored rule with an unknown enum value under `hasNot` / `isNot`.** Left as-is it can match almost every post. Pinned by `sanitizeCondition` (Task 2) and `conditionProblem` returning `incomplete`, with unit tests.
- **An incomplete or empty rule.** A half-typed condition must not hide everything. Pinned by the zero-complete-conditions test in Task 2.
- **Invalid user regex.** Must never throw into the page and must be shown in the UI. Pinned by the invalid-regex unit test (Task 2) and the inline warning (Task 6).
- **X recycling a timeline cell with another post.** A stale `data-xp-filtered` on a reused cell would hide an innocent post. Pinned by the `WeakMap` mark bookkeeping (Task 5) and the harness scroll/reload check.
- **The focal post on `/status/`.** Opening a post must never hide it. Pinned by `readPost` returning `null` for the first article on a status page (Task 4) and a manual check.

---

### Task 1: `field.records` schema type

**Files:**
- Modify: `src/core/schema.js`
- Test: `test/schema.test.js`

**Interfaces:**
- Consumes: `normalizeFields` in the same file.
- Produces: `field.records(fields, { max, idKey, idPrefix, sanitizeItem })` → `{ type: 'records', fields, max, idKey, idPrefix, sanitizeItem }`; `normalizeField` handles `type: 'records'`; `defaultOf` returns a fresh `[]`.
- `idKey` defaults to `'id'`; pass `idKey: null` for nested lists that need no id. Ids match `^[a-z0-9][a-z0-9-]{0,39}$`, are unique within the array, and are generated as `<idPrefix>-<base36 counter + random>` when missing, invalid or duplicated.
- `sanitizeItem(item)` runs after normalization and id assignment; it may mutate and must return the item.

- [ ] **Step 1: Write the failing tests**

Append to `test/schema.test.js`:

```js
test('records normalize items, cap the list and generate ids', () => {
  const conditionFields = {
    field: field.enum(['text'], 'text'),
    op: field.text('contains'),
    value: field.text(''),
  };
  const ruleFields = {
    id: field.text('', { max: 40 }),
    name: field.text(''),
    conditions: field.records(conditionFields, { max: 1, idKey: null }),
  };
  const spec = field.records(ruleFields, { max: 2, idPrefix: 'r' });

  const out = normalizeField(spec, [
    { name: ' a ', conditions: [{ field: 'text', op: 'contains', value: 'x', junk: 1 }, { field: 'text', op: 'contains', value: 'y' }], junk: true },
    { id: 'bad id !', name: 'b' },
    { name: 'c' },
    null,
    'nope',
  ]);

  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'a');
  assert.equal(out[0].conditions.length, 1); // nested max
  assert.deepEqual(Object.keys(out[0].conditions[0]).sort(), ['field', 'op', 'value']);
  assert.match(out[0].id, /^r-[a-z0-9]+$/);
  assert.match(out[1].id, /^r-[a-z0-9]+$/);
  assert.notEqual(out[0].id, out[1].id);
});

test('records keep valid unique ids and run sanitizeItem', () => {
  const spec = field.records(
    { id: field.text(''), value: field.text('') },
    { sanitizeItem: (item) => ({ ...item, value: item.value === 'bad' ? '' : item.value }) },
  );
  const out = normalizeField(spec, [
    { id: 'keep-me', value: 'ok' },
    { id: 'keep-me', value: 'bad' },
  ]);
  assert.equal(out[0].id, 'keep-me');
  assert.notEqual(out[1].id, 'keep-me');
  assert.equal(out[1].value, '');
});

test('records default to a fresh empty array', () => {
  const spec = field.records({ id: field.text('') });
  const a = defaultOf(spec);
  const b = defaultOf(spec);
  assert.deepEqual(a, []);
  assert.notEqual(a, b);
  assert.deepEqual(normalizeField(spec, 'not an array'), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `field.records is not a function`.

- [ ] **Step 3: Implement `field.records` and its normalization**

In `src/core/schema.js`:

```js
let recordsSeq = 0;
function recordsId(prefix) {
  recordsSeq += 1;
  return `${prefix}-${Date.now().toString(36)}${recordsSeq.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`.slice(0, 40);
}

field.records = (fields, { max = 50, idKey = 'id', idPrefix = 'r', sanitizeItem } = {}) => ({
  type: 'records',
  fields,
  max,
  idKey,
  idPrefix,
  sanitizeItem,
});
```

In `defaultOf`, before the final `return spec.default`:

```js
if (spec.type === 'records') return [];
```

In `normalizeField`, add:

```js
case 'records': {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const normalized = normalizeFields(spec.fields, item);
    if (spec.idKey) {
      let id = typeof normalized[spec.idKey] === 'string' ? normalized[spec.idKey].trim().toLowerCase() : '';
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || seen.has(id)) id = recordsId(spec.idPrefix);
      normalized[spec.idKey] = id;
      seen.add(id);
    }
    out.push(spec.sanitizeItem ? spec.sanitizeItem(normalized) : normalized);
    if (out.length >= spec.max) break;
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including the existing schema tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/schema.js test/schema.test.js
git commit -m "feat(schema): add records field for lists of normalized objects"
```

---

### Task 2: Condition catalog and pure matcher

**Files:**
- Create: `src/features/filter/config.js`
- Create: `src/features/filter/match.js`
- Test: `test/filter-match.test.js`

**Interfaces:**
- Consumes: `field` from `../../core/schema.js`; `normalizeHandle` from `../../utils/handle.js`.
- Produces from `config.js`:
  - `LIMITS = { rules: 50, conditions: 20, name: 60, value: 500 }`
  - `TEXT_OPS` (frozen array of the 12 text operators)
  - `FIELDS` — `{ [field]: { ops: string[], value: 'text' | 'handle' | 'lang' | string[] } }`
  - `FIELD_NAMES` (frozen `Object.keys(FIELDS)`)
  - `takesValue(op) → boolean` (`false` for `empty` / `notEmpty`)
  - `filterFields` — schema fields `{ enabled: field.bool(false), rules: field.records(ruleFields, { max, idPrefix: 'r' }) }`
  - `newCondition() → { field: 'text', op: 'contains', value: '' }`
  - `newRule() → { id, name: '', enabled: true, match: 'all', conditions: [newCondition()] }`
  - `sanitizeCondition(item) → item`
- Produces from `match.js`:
  - `conditionProblem(condition) → 'incomplete' | 'regex' | null`
  - `compileCondition(condition) → { field, op, value, regex, wordRe } | null`
  - `testCondition(compiled, facts) → boolean`
  - `compileRules(cfg) → { id, match: 'all'|'any', conditions: compiled[] }[]` (master switch off, disabled rules and incomplete conditions are skipped; a rule with no complete conditions is omitted)
  - `postMatches(rules, facts) → boolean`
- Facts contract produced by Task 4: `{ authorName, handle, text, lang, media: Set, attachments: Set, meta: Set }`; `authorName`/`handle`/`text` are already lower-cased, `lang` is lower-case or `''`.

Catalog values (exact):

```js
FIELDS = {
  authorName: { ops: TEXT_OPS, value: 'text' },
  handle:     { ops: TEXT_OPS, value: 'handle' },
  text:       { ops: TEXT_OPS, value: 'text' },
  lang:       { ops: ['is', 'isNot'], value: 'lang' },
  media:      { ops: ['has', 'hasNot'], value: ['any', 'photo', 'video'] },
  attachment: { ops: ['has', 'hasNot'], value: ['link', 'quote', 'poll', 'article'] },
  meta:       { ops: ['is', 'isNot'], value: ['promoted', 'verified', 'context'] },
}
TEXT_OPS = ['contains', 'notContains', 'word', 'notWord', 'startsWith',
  'endsWith', 'equals', 'notEquals', 'empty', 'notEmpty', 'regex', 'notRegex']
```

- [ ] **Step 1: Write the failing tests**

Create `test/filter-match.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { newRule, sanitizeCondition } from '../src/features/filter/config.js';
import {
  compileCondition,
  compileRules,
  conditionProblem,
  postMatches,
  testCondition,
} from '../src/features/filter/match.js';

const facts = (patch = {}) => ({
  authorName: 'chanhee 🇺🇦',
  handle: 'hiddnest',
  text: 'hello world airdrop',
  lang: 'en-gb',
  media: new Set(),
  attachments: new Set(),
  meta: new Set(),
  ...patch,
});

const test1 = (condition, patch) => {
  const compiled = compileCondition(condition);
  assert.ok(compiled, `condition should compile: ${JSON.stringify(condition)}`);
  return testCondition(compiled, facts(patch));
};

test('text operators', () => {
  assert.equal(test1({ field: 'text', op: 'contains', value: 'AIRDROP' }), true);
  assert.equal(test1({ field: 'text', op: 'notContains', value: 'absent' }), true);
  assert.equal(test1({ field: 'text', op: 'word', value: 'airdrop' }), true);
  assert.equal(test1({ field: 'text', op: 'word', value: 'air' }), false);
  assert.equal(test1({ field: 'text', op: 'notWord', value: 'air' }), true);
  assert.equal(test1({ field: 'text', op: 'startsWith', value: 'hello' }), true);
  assert.equal(test1({ field: 'text', op: 'endsWith', value: 'airdrop' }), true);
  assert.equal(test1({ field: 'text', op: 'equals', value: 'hello world airdrop' }), true);
  assert.equal(test1({ field: 'text', op: 'notEquals', value: 'other' }), true);
  assert.equal(test1({ field: 'text', op: 'empty' }, { text: '' }), true);
  assert.equal(test1({ field: 'text', op: 'notEmpty' }, { text: '' }), false);
  assert.equal(test1({ field: 'text', op: 'regex', value: '^hello\\s+world' }), true);
  assert.equal(test1({ field: 'text', op: 'regex', value: '/AIRDROP/i' }), true);
  assert.equal(test1({ field: 'text', op: 'notRegex', value: '^bye' }), true);
});

test('text fields use their own facts and flags survive', () => {
  assert.equal(test1({ field: 'authorName', op: 'contains', value: '🇺🇦' }), true);
  assert.equal(test1({ field: 'handle', op: 'equals', value: '@HiddNest' }), true);
  assert.equal(test1({ field: 'text', op: 'contains', value: '🇺🇦' }), false);
});

test('language matching is prefix-aware and unknown is false', () => {
  assert.equal(test1({ field: 'lang', op: 'is', value: 'en' }), true);
  assert.equal(test1({ field: 'lang', op: 'is', value: 'zh-CN' }), false);
  assert.equal(test1({ field: 'lang', op: 'isNot', value: 'ru' }), true);
  assert.equal(test1({ field: 'lang', op: 'is', value: 'en' }, { lang: '' }), false);
  assert.equal(test1({ field: 'lang', op: 'isNot', value: 'en' }, { lang: '' }), false);
});

test('set operators', () => {
  assert.equal(test1({ field: 'media', op: 'has', value: 'any' }, { media: new Set(['photo']) }), true);
  assert.equal(test1({ field: 'media', op: 'has', value: 'photo' }, { media: new Set(['photo']) }), true);
  assert.equal(test1({ field: 'media', op: 'hasNot', value: 'any' }, { media: new Set() }), true);
  assert.equal(
    test1({ field: 'attachment', op: 'has', value: 'quote' }, { attachments: new Set(['quote']) }),
    true,
  );
  assert.equal(test1({ field: 'meta', op: 'is', value: 'promoted' }, { meta: new Set(['promoted']) }), true);
  assert.equal(test1({ field: 'meta', op: 'isNot', value: 'verified' }, { meta: new Set(['promoted']) }), true);
});

test('incomplete and invalid conditions never compile', () => {
  assert.equal(compileCondition({ field: 'text', op: 'contains', value: '   ' }), null);
  assert.equal(compileCondition({ field: 'media', op: 'has', value: 'junk' }), null);
  assert.equal(compileCondition({ field: 'text', op: 'junk', value: 'x' }), null);
  assert.equal(compileCondition({ field: 'lang', op: 'isNot', value: 'junk' }), null);
  assert.equal(compileCondition({ field: 'text', op: 'regex', value: '[' }), null);
  assert.equal(conditionProblem({ field: 'text', op: 'regex', value: '[' }), 'regex');
  assert.equal(conditionProblem({ field: 'text', op: 'contains', value: '' }), 'incomplete');
  assert.equal(conditionProblem({ field: 'text', op: 'contains', value: 'x' }), null);
});

test('sanitizeCondition blanks cross-field garbage', () => {
  const badOp = sanitizeCondition({ field: 'media', op: 'contains', value: 'photo' });
  assert.equal(badOp.op, '');
  const badValue = sanitizeCondition({ field: 'media', op: 'hasNot', value: 'junk' });
  assert.equal(badValue.value, '');
  const badLang = sanitizeCondition({ field: 'lang', op: 'isNot', value: 'junk' });
  assert.equal(badLang.value, '');
  const noValue = sanitizeCondition({ field: 'text', op: 'empty', value: 'leftover' });
  assert.equal(noValue.value, '');
});

test('rules combine conditions with all/any and skip disabled rules', () => {
  const rule = {
    ...newRule(),
    match: 'all',
    conditions: [
      { field: 'text', op: 'contains', value: 'airdrop' },
      { field: 'media', op: 'hasNot', value: 'any' },
    ],
  };
  const all = compileRules({ enabled: true, rules: [rule] });
  assert.equal(postMatches(all, facts()), true);
  assert.equal(postMatches(all, facts({ media: new Set(['photo']) })), false);

  const any = compileRules({ enabled: true, rules: [{ ...rule, match: 'any' }] });
  assert.equal(postMatches(any, facts({ media: new Set(['photo']) })), true);

  assert.deepEqual(compileRules({ enabled: false, rules: [rule] }), []);
  assert.deepEqual(compileRules({ enabled: true, rules: [{ ...rule, enabled: false }] }), []);
  assert.deepEqual(compileRules({ enabled: true, rules: [{ ...rule, conditions: [{ field: 'text', op: 'contains', value: '' }] }] }), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find `src/features/filter/config.js`.

- [ ] **Step 3: Implement the catalog and matcher**

`config.js`:

```js
import { field } from '../../core/schema.js';
import { normalizeHandle } from '../../utils/handle.js';

export const LIMITS = Object.freeze({ rules: 50, conditions: 20, name: 60, value: 500 });
export const TEXT_OPS = Object.freeze(['contains', 'notContains', 'word', 'notWord',
  'startsWith', 'endsWith', 'equals', 'notEquals', 'empty', 'notEmpty', 'regex', 'notRegex']);
export const FIELDS = Object.freeze({
  authorName: { ops: TEXT_OPS, value: 'text' },
  handle: { ops: TEXT_OPS, value: 'handle' },
  text: { ops: TEXT_OPS, value: 'text' },
  lang: { ops: Object.freeze(['is', 'isNot']), value: 'lang' },
  media: { ops: Object.freeze(['has', 'hasNot']), value: Object.freeze(['any', 'photo', 'video']) },
  attachment: { ops: Object.freeze(['has', 'hasNot']), value: Object.freeze(['link', 'quote', 'poll', 'article']) },
  meta: { ops: Object.freeze(['is', 'isNot']), value: Object.freeze(['promoted', 'verified', 'context']) },
});
export const FIELD_NAMES = Object.freeze(Object.keys(FIELDS));
export const takesValue = (op) => op !== 'empty' && op !== 'notEmpty';

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
  conditions: field.records(conditionFields, { max: LIMITS.conditions, idKey: null, sanitizeItem: sanitizeCondition }),
};
export const filterFields = {
  enabled: field.bool(false),
  rules: field.records(ruleFields, { max: LIMITS.rules, idPrefix: 'r' }),
};

export function sanitizeCondition(item) {
  const spec = FIELDS[item.field];
  if (!spec || !spec.ops.includes(item.op)) item.op = '';
  if (!takesValue(item.op)) item.value = '';
  else if (spec?.value === 'lang') {
    const lang = String(item.value || '').trim().toLowerCase();
    item.value = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(lang) ? lang : '';
  } else if (spec?.value === 'handle') item.value = normalizeHandle(item.value);
  else if (Array.isArray(spec?.value) && !spec.value.includes(item.value)) item.value = '';
  return item;
}

export function newCondition() {
  return { field: 'text', op: 'contains', value: '' };
}

let ruleSeq = 0;
export function newRule() {
  ruleSeq += 1;
  return {
    id: `r-${Date.now().toString(36)}${ruleSeq.toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(0, 40),
    name: '',
    enabled: true,
    match: 'all',
    conditions: [newCondition()],
  };
}
```

`match.js` — implement exactly these semantics:

```js
import { FIELDS, takesValue } from './config.js';
import { normalizeHandle } from '../../utils/handle.js';

const WORD_BOUNDARY = (value) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(value)}(?![\\p{L}\\p{N}_])`, 'iu');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRegex(source) {
  const text = String(source);
  const literal = /^\/([\s\S]+)\/([a-z]*)$/.exec(text);
  try {
    return literal
      ? new RegExp(literal[1], literal[2].replace(/[gy]/g, ''))
      : new RegExp(text, 'iu');
  } catch {
    return null;
  }
}

export function conditionProblem(condition) {
  const spec = condition && FIELDS[condition.field];
  if (!spec || !spec.ops.includes(condition.op)) return 'incomplete';
  const value = String(condition.value ?? '');
  if (takesValue(condition.op) && !value.trim()) return 'incomplete';
  if (spec.value === 'lang' && !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(value.trim())) return 'incomplete';
  if (Array.isArray(spec.value) && !spec.value.includes(condition.value)) return 'incomplete';
  if ((condition.op === 'regex' || condition.op === 'notRegex') && !compileRegex(value)) return 'regex';
  return null;
}

export function compileCondition(condition) {
  if (conditionProblem(condition)) return null;
  const spec = FIELDS[condition.field];
  const raw = String(condition.value ?? '');
  const isRegex = condition.op === 'regex' || condition.op === 'notRegex';
  let value = takesValue(condition.op) ? raw : '';
  if (!isRegex) {
    value = condition.field === 'handle' ? normalizeHandle(value) : value.toLowerCase();
  }
  return {
    field: condition.field,
    op: condition.op,
    value,
    regex: isRegex ? compileRegex(raw) : null,
    wordRe: condition.op === 'word' || condition.op === 'notWord' ? WORD_BOUNDARY(raw) : null,
  };
}

export function testCondition(condition, facts) {
  switch (condition.field) {
    case 'lang':
      return testLang(condition, facts.lang);
    case 'media':
      return testSet(condition, facts.media);
    case 'attachment':
      return testSet(condition, facts.attachments);
    case 'meta':
      return testSet(condition, facts.meta);
    default:
      return testText(condition, String(facts[condition.field] ?? ''));
  }
}

function testLang(condition, lang) {
  if (!lang) return false;
  const match = lang === condition.value || lang.startsWith(`${condition.value}-`);
  return condition.op === 'is' ? match : !match;
}

function testSet(condition, set) {
  const present = condition.value === 'any' ? set.size > 0 : set.has(condition.value);
  return condition.op === 'has' || condition.op === 'is' ? present : !present;
}

function testText(condition, text) {
  switch (condition.op) {
    case 'contains': return text.includes(condition.value);
    case 'notContains': return !text.includes(condition.value);
    case 'word': return condition.wordRe.test(text);
    case 'notWord': return !condition.wordRe.test(text);
    case 'startsWith': return text.startsWith(condition.value);
    case 'endsWith': return text.endsWith(condition.value);
    case 'equals': return text === condition.value;
    case 'notEquals': return text !== condition.value;
    case 'empty': return text.trim() === '';
    case 'notEmpty': return text.trim() !== '';
    case 'regex': return condition.regex.test(text);
    case 'notRegex': return !condition.regex.test(text);
    default: return false;
  }
}

export function compileRules(cfg) {
  if (!cfg?.enabled) return [];
  const out = [];
  for (const rule of cfg.rules ?? []) {
    if (!rule?.enabled) continue;
    const conditions = (rule.conditions ?? []).map(compileCondition).filter(Boolean);
    if (!conditions.length) continue;
    out.push({ id: rule.id, match: rule.match === 'any' ? 'any' : 'all', conditions });
  }
  return out;
}

export function postMatches(rules, facts) {
  for (const rule of rules) {
    const hit = rule.match === 'any'
      ? rule.conditions.some((condition) => testCondition(condition, facts))
      : rule.conditions.every((condition) => testCondition(condition, facts));
    if (hit) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/filter/config.js src/features/filter/match.js test/filter-match.test.js
git commit -m "feat(filter): add condition catalog and pure post matcher"
```

---

### Task 3: Localization for the Filtering tab

**Files:**
- Modify: `src/i18n/locales/en.js`, `ru.js`, `zh.js`, `es.js`, `pt.js`, `de.js`, `fr.js`, `ja.js`
- Modify: `scripts/check-i18n.mjs`

**Interfaces:**
- Produces: every `filter.*` key below in all 8 locales. Dynamic keys are generated by the check script from `src/features/filter/config.js`.

- [ ] **Step 1: Add the keys to `en.js`**

Append (adjust grouping to the file's order):

```js
'filter.title': 'Filtering',
'filter.enabled': 'Filter posts',
'filter.enabledHint': 'Hide posts that match any of your rules. Matching happens live as you scroll.',
'filter.sectionMain': 'Filtering',
'filter.sectionRules': 'Rules',
'filter.sectionRulesDesc': 'A post is hidden when it matches any rule. Inside a rule, conditions are combined with “all” or “any”.',
'filter.addRule': 'Add rule',
'filter.empty': 'No rules yet. Add one to start hiding posts.',
'filter.limitRules': 'Rule limit reached ({max}).',
'filter.ruleEnabled': 'Rule enabled',
'filter.ruleNamePlaceholder': 'Rule name',
'filter.match': 'Conditions match',
'filter.matchAll': 'All conditions (AND)',
'filter.matchAny': 'Any condition (OR)',
'filter.conditions': 'Conditions',
'filter.addCondition': 'Add condition',
'filter.limitConditions': 'Condition limit reached ({max}).',
'filter.removeCondition': 'Remove condition',
'filter.removeRule': 'Delete rule',
'filter.moveUp': 'Move up',
'filter.moveDown': 'Move down',
'filter.test': 'Test on this page',
'filter.testResult': 'Matching posts on screen: {count}',
'filter.incomplete': 'Fill in a value to activate this condition.',
'filter.invalidRegex': 'Invalid regular expression — this condition is ignored.',
'filter.valuePlaceholder': 'Value',
'filter.langPlaceholder': 'Language code, e.g. en',
'filter.handlePlaceholder': '@handle',
'filter.field.authorName': 'Author name',
'filter.field.handle': 'Author @handle',
'filter.field.text': 'Post text',
'filter.field.lang': 'Post language',
'filter.field.media': 'Media',
'filter.field.attachment': 'Attachment',
'filter.field.meta': 'Post flags',
'filter.op.contains': 'contains',
'filter.op.notContains': 'does not contain',
'filter.op.word': 'contains the whole word',
'filter.op.notWord': 'does not contain the whole word',
'filter.op.startsWith': 'starts with',
'filter.op.endsWith': 'ends with',
'filter.op.equals': 'is exactly',
'filter.op.notEquals': 'is not exactly',
'filter.op.empty': 'is empty',
'filter.op.notEmpty': 'is not empty',
'filter.op.regex': 'matches the regular expression',
'filter.op.notRegex': 'does not match the regular expression',
'filter.op.is': 'is',
'filter.op.isNot': 'is not',
'filter.op.has': 'has',
'filter.op.hasNot': 'does not have',
'filter.value.media.any': 'Any media',
'filter.value.media.photo': 'Photo',
'filter.value.media.video': 'Video or GIF',
'filter.value.attachment.link': 'Link card',
'filter.value.attachment.quote': 'Quoted post',
'filter.value.attachment.poll': 'Poll',
'filter.value.attachment.article': 'Article',
'filter.value.meta.promoted': 'Promoted / ad',
'filter.value.meta.verified': 'Verified author',
'filter.value.meta.context': 'Context line (reposted / pinned / liked)',
```

- [ ] **Step 2: Add the same keys to the other 7 locales**

Translate naturally; keep placeholders `{max}` and `{count}` unchanged. Do not leave English values in non-English locales.

- [ ] **Step 3: Teach the i18n check about the new namespace and dynamic keys**

In `scripts/check-i18n.mjs`:

Add `'filter'` to `NAMESPACES`. In `dynamicKeys()`:

```js
const filter = await import(pathToFileURL(join(src, 'features', 'filter', 'config.js')).href);
for (const fieldName of Object.keys(filter.FIELDS)) {
  keys.add(`filter.field.${fieldName}`);
  const spec = filter.FIELDS[fieldName];
  for (const op of spec.ops) keys.add(`filter.op.${op}`);
  if (Array.isArray(spec.value)) {
    for (const value of spec.value) keys.add(`filter.value.${fieldName}.${value}`);
  }
}
```

- [ ] **Step 4: Run the check**

Run: `npm run check:i18n`
Expected: exit 0. Unused-key warnings for strings not referenced yet are acceptable at this stage.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales scripts/check-i18n.mjs
git commit -m "feat(i18n): add filtering strings to every locale"
```

---

### Task 4: DOM facts for one post

**Files:**
- Modify: `src/features/interface/rules.js` (exports only)
- Create: `src/features/filter/facts.js`

**Interfaces:**
- Consumes: `SEL`, `isPromotedArticle`, `quoteCardOf`, `normalizeHandle`.
- Produces: `readPost(article) → null | { authorName, handle, text, lang, media: Set, attachments: Set, meta: Set }`.
- The returned strings are lower-cased (display name and text) or normalized (handle); `lang` is lower-case or `''`.
- Returns `null` for posts inside `[role="dialog"]`, inside our UI, disconnected nodes, and the focal post (first article in `SEL.primaryColumn` on a `/…/status/…` path).

- [ ] **Step 1: Export the two helpers from `interface`**

In `src/features/interface/rules.js`, change:

```js
function isPromotedArticle(article) { … }
function quoteCardOf(node, article) { … }
```

to:

```js
export function isPromotedArticle(article) { … }
export function quoteCardOf(node, article) { … }
```

No other change in that file.

- [ ] **Step 2: Implement `facts.js`**

Selectors at the top:

```js
const POLL = '[data-testid="card.poll"]';
const LINK_CARD = '[data-testid="card.wrapper"]';
const ARTICLE_COVER = '[data-testid="article-cover-image"]';
const VERIFIED = '[data-testid="icon-verified"]';
const SOCIAL_CONTEXT = '[data-testid="socialContext"]';
const VIDEO = `${SEL.videoPlayer}, [data-testid="previewInterstitial"]`;
```

Required behavior:

- `plainText(root)` — a **read-only** recursive walk: text nodes append their value; `IMG` appends `alt`; an element with `role="img"` and `aria-label` appends the label and does not descend; otherwise descend into children. Skip `[data-testid="icon-verified"]` and similar badge SVGs so their aria-labels ("Verified account") do not leak into the author name. Normalize ` `, collapse whitespace, trim, lower-case the final string. Do not reuse `materializeEmojiImages()`: it mutates X's DOM.
- `quoteCards(article)` — `SEL.quoteTweet` nodes plus every `SEL.quoteAvatar`'s `quoteCardOf(avatar, article)`.
- Outer header — the first `SEL.userName` in `article` not inside a quote card.
- `authorName` — first `a[href]` in the header whose `plainText` does not start with `@`; fallback to the header, then `article`. `handle` — first anchor or span in the header whose text starts with `@`, passed through `normalizeHandle`.
- `text` — the first `SEL.tweetText` not inside a quote card, read with `plainText`.
- `lang` — the `lang` attribute of that same tweet-text node, lower-cased.
- `media` — for each `SEL.photo` / `VIDEO` outside quote cards: `video` when the node matches or contains `VIDEO`, otherwise `photo`.
- `attachments` — `link` for `LINK_CARD`, `poll` for `POLL`, `article` for `ARTICLE_COVER` outside quote cards; `quote` when `quoteCards(article).length > 0`.
- `meta` — `promoted` from `isPromotedArticle(article)`; `verified` from `VERIFIED` inside the outer header; `context` from `SOCIAL_CONTEXT` in `article.closest(SEL.cell)`.
- Focal post — cache the first `SEL.primaryColumn ${SEL.article}` per pathname; on a path containing `/status/`, that article returns `null`.

- [ ] **Step 3: Verify the module parses and the build still works**

Run: `npm run check:syntax && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/interface/rules.js src/features/filter/facts.js
git commit -m "feat(filter): read post facts from the timeline"
```

---

### Task 5: Filtering engine and feature registration

**Files:**
- Create: `src/features/filter/engine.js`
- Create: `src/features/filter/index.js`
- Modify: `src/main.js` (import the feature only; styles come in Task 6)

**Interfaces:**
- Consumes: `compileRules`, `postMatches`, `readPost`, `filterFields`, `getFeatureSettings`.
- Produces from `engine.js`:
  - `sync(cfg)` — apply a settings section (compile, write CSS, connect/disconnect, reprocess on-screen posts, take back marks when off).
  - `sweep()` — clear marks from cells without an article and reprocess current posts (navigation).
  - `previewRule(rule) → number` — compile one draft rule, set `data-xp-peek` on matching cells (which lifts the hide), outline them, return the count of matching posts currently visible on screen.
  - `clearPreview()` — remove `data-xp-peek` and the preview style.
- `index.js` registers feature `filter` (order 35) with `filterFields`, `apply(cfg) → sync(cfg)`, `navigate() → sweep()`. It has **no tab yet**.

Constants: `STYLE_ID = 'xp-filter-style'`, `PEEK_STYLE_ID = 'xp-filter-peek-style'`, `MARK_ATTR = 'data-xp-filtered'`, `PEEK_ATTR = 'data-xp-peek'`, `BUDGET_MS = 8`.

Implementation notes (follow `interface/engine.js`):

- Stylesheet: `[data-xp-filtered]:not([data-xp-peek]){display:none!important}`.
- Module state: `rules`, `observer`, `dirty: Set`, `frame`, `marked: WeakMap<article, cell>`.
- `sync`: `rules = compileRules(cfg)`; if empty → disconnect, clear all `[data-xp-filtered]` attributes, reset the WeakMap and return. Otherwise write CSS, observe `document.documentElement` with `{ childList: true, subtree: true }`, enqueue every `SEL.article`, `flush()`, `sweep()`.
- Mutation handling: for each added element node, enqueue `node.closest(SEL.article)` when it exists and is not inside `[data-xp-ui]`; otherwise enqueue all `SEL.article` descendants not inside our UI. Removals need no action.
- `flush`: process the dirty set synchronously, stop after 8 ms, continue on `requestAnimationFrame`.
- `process(article)`: `cell = article.closest(SEL.cell) || article`; `facts = readPost(article)`; `hit = facts ? postMatches(rules, facts) : false`; on hit set `MARK_ATTR` on the cell and remember it in `marked`; otherwise remove the attribute from the remembered cell and delete the entry. If the remembered cell differs from the current cell, clear the old one first.
- `sweep`: remove the attribute from any marked cell that contains no `SEL.article`; enqueue all current articles.
- `previewRule`: `compileRules({ enabled: true, rules: [{ ...rule, enabled: true }] })`; `clearPreview()`; for every `SEL.primaryColumn ${SEL.article}`, read facts, test, set `data-xp-peek` on the cell, and count it when `isOnScreen(cell)`; write the outline style (accent outline + soft glow) when the count is non-zero; return the count.
- `clearPreview`: remove `data-xp-peek` everywhere and remove the preview style element.
- No `getComputedStyle`; `getBoundingClientRect` only inside `previewRule`'s `isOnScreen`.

`index.js`:

```js
import { registerFeature } from '../../core/features.js';
import { filterFields } from './config.js';
import { sweep, sync } from './engine.js';

registerFeature({
  id: 'filter',
  order: 35,
  fields: filterFields,
  apply(cfg) {
    sync(cfg);
  },
  navigate() {
    sweep();
  },
});
```

`src/main.js`: add `import './features/filter/index.js';` after the interface import.

- [ ] **Step 1: Write `engine.js` and `index.js`**

Follow the notes above; reuse `isOnScreen` from `interface/engine.js` (copy the five-line helper).

- [ ] **Step 2: Import the feature in `main.js`**

- [ ] **Step 3: Verify**

Run: `npm run check:syntax && npm run build && npm run harness`
Expected: build and server start. In the harness the feature is off by default, so the page looks unchanged and the console has no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/filter/engine.js src/features/filter/index.js src/main.js
git commit -m "feat(filter): add the live post filtering engine"
```

---

### Task 6: Rule-builder settings tab and styles

**Files:**
- Create: `src/features/filter/settings.js`
- Modify: `src/features/filter/index.js` (add the tab)
- Create: `src/styles/filter.css`
- Modify: `src/main.js` (import the stylesheet)

**Interfaces:**
- Consumes: `FIELDS`, `FIELD_NAMES`, `LIMITS`, `newCondition`, `newRule`, `takesValue` from `config.js`; `conditionProblem` from `match.js`; `previewRule`, `clearPreview` from `engine.js`; `TARGET_LANGUAGES`; `createSwitch`, `createSelect`, `createTextInput`, `createButton`, `createHint`, `createSection`; `el`, `t`, `fmt`, `showToast`.
- Produces: `renderFilterTab(ctx) → HTMLElement`; feature tab `{ id: 'filter', titleKey: 'filter.title', badge, render: renderFilterTab }`.

Tab behavior:

- Root is `el('div', 'xp-tab')` with two sections: master switch (`enabled`) and rules.
- Badge: `t('common.off')` when `!draft.filter.enabled`, otherwise the number of enabled rules as a string.
- Rule list is rebuilt locally on structural edits (add/remove/move/field/operator change); plain text edits update the draft and call `ctx.changed()` without repainting, so typing keeps focus.
- Each rule card: enable switch (aria-label `filter.ruleEnabled`), name input (placeholder `filter.ruleNamePlaceholder`), Move up / Move down / Delete buttons with `aria-label`s, mode select (`filter.matchAll` / `filter.matchAny`), a `filter.conditions` subheading, condition rows, "Add condition" (disabled at `LIMITS.conditions`), "Test on this page".
- Condition row: field select (labels `filter.field.<name>`), operator select (labels `filter.op.<op>`), then a value control:
  - no control for `empty` / `notEmpty`;
  - enum select for `media` / `attachment` / `meta` (labels `filter.value.<field>.<value>`);
  - text input with `datalist` of `TARGET_LANGUAGES` codes for `lang`;
  - text input with `filter.handlePlaceholder` for `handle`;
  - text input with `filter.valuePlaceholder` otherwise.
  When the field changes, reset the operator to the first allowed one and clear the value. When the operator stops taking a value, clear it. Both repaint.
- Show `createHint(t('filter.invalidRegex'))` when `conditionProblem` is `'regex'`, and `createHint(t('filter.incomplete'))` when it is `'incomplete'`.
- Test: call `previewRule(rule)`, add `is-peeking` to `.xp-settings-backdrop`, toast `fmt(t('filter.testResult'), { count })`, and clear after 4 seconds with `clearPreview()` plus removing the class.
- "Add rule" disabled at `LIMITS.rules`; when a limit is reached show `filter.limitRules` / `filter.limitConditions` with `{max}`.
- Empty state uses `filter.empty`.

Styles (`src/styles/filter.css`, imported in `main.js` next to the other styles):

- `.xp-filter-rule` card (border, radius, spacing, `var(--xp-*)`), the header row, the name input growing, compact action buttons, the condition rows (wrapping on narrow widths, no horizontal page scroll), muted hints and warnings, and the empty state.

- [ ] **Step 1: Write `settings.js`** following the behavior above.

- [ ] **Step 2: Add the tab to `index.js`**

Import `renderFilterTab` and `t`, add `badge` and `tabs: [{ id: 'filter', titleKey: 'filter.title', badge, render: renderFilterTab }]`.

- [ ] **Step 3: Write the stylesheet and import it**

Add `import './styles/filter.css';` to `src/main.js`.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run check:i18n`
Expected: both exit 0.

Run `npm run harness`, open the settings dialog, and check:

- Filtering tab appears with the empty state.
- Add a rule, set the author name condition to a value visible in the harness, and press Test: matching posts are outlined and the toast reports a count.
- Save and confirm matching cells disappear; disable the master switch, save, and confirm they return.
- With a saved hiding rule active, press Test on a matching draft rule: the hidden post is revealed and outlined.
- Reload: no stale hidden cell without a matching post.

- [ ] **Step 5: Commit**

```bash
git add src/features/filter/settings.js src/features/filter/index.js src/styles/filter.css src/main.js
git commit -m "feat(filter): add the rule builder settings tab"
```

---

### Task 7: Documentation and full verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

Add `filter/` to the repository layout and a `### filter` section covering: the one-level model (rules OR-ed, conditions all/any), the fields and operators, the per-post observer and `data-xp-filtered` contract, the `field.records` schema type, and the file roles (`config`, `match`, `facts`, `engine`, `settings`).

- [ ] **Step 2: Update `README.md`**

Add Filtering to the feature list / settings description, with the same tone as the existing entries: rules with AND/OR, fields, live hiding, test preview.

- [ ] **Step 3: Update `CHANGELOG.md`**

Add an `## [Unreleased]` section at the top with one `### Added` bullet describing the outcome (users can hide posts with custom AND/OR rules by author name, handle, text, language, media, attachments and flags). No work-log detail.

- [ ] **Step 4: Run the full CI gate**

Run: `npm run ci`
Expected: syntax, i18n, tests, build and artifact verification all pass.

- [ ] **Step 5: Final harness check**

Run `npm run build && npm run harness` and repeat the Task 6 checks, plus:

- A rule with an emoji flag in the author name matches a post whose name contains the flag image.
- A post on a `/status/`-like route (open a post in the harness if available) is never hidden.
- Scrolling a long feed never leaves a blank cell where a non-matching post was recycled.

- [ ] **Step 6: Commit**

```bash
git add docs/ARCHITECTURE.md README.md CHANGELOG.md
git commit -m "docs(filter): document the post filtering feature"
```

---

## Self-review notes

- Spec coverage: schema type → Task 1; catalog/matcher → Task 2; i18n → Task 3; facts (emoji, verified scoping, focal post) → Task 4; engine/marks/preview → Task 5; tab/styles/Test → Task 6; docs/CI → Task 7.
- The media/GIF limitation, the `context` metadata meaning, and the unknown-language semantics are encoded in the catalog and matcher, not left open.
- Names used across tasks: `readPost`, `compileRules`, `postMatches`, `previewRule`, `clearPreview`, `sync`, `sweep`, `filterFields`, `conditionProblem` — consistent throughout.
- Review Focus items each have a unit test (Tasks 1–2) or a manual harness step (Tasks 4–7).
