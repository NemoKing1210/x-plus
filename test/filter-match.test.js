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

test('literal regex flags stay case-insensitive', () => {
  assert.equal(test1({ field: 'text', op: 'regex', value: '/Airdrop/' }), true);
  assert.equal(test1({ field: 'text', op: 'notRegex', value: '/Airdrop/' }), false);
  assert.equal(test1({ field: 'text', op: 'regex', value: '/AIRDROP/u' }), true);
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
