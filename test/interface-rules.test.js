import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleApplies } from '../src/features/interface/rule-applies.js';

test('a legacy-only rule is skipped on modern', () => {
  const rule = { key: 'legacyThing', generations: { modern: false } };
  assert.equal(ruleApplies(rule, 'modern'), false);
  assert.equal(ruleApplies(rule, 'legacy'), true);
  assert.equal(ruleApplies({ key: 'all' }, 'modern'), true);
});

test('an unknown generation keeps every rule on', () => {
  const rule = { key: 'legacyThing', generations: { modern: false } };
  assert.equal(ruleApplies(rule, 'unknown'), true);
  assert.equal(ruleApplies(rule, ''), true);
});

test('an explicit true keeps a rule on', () => {
  assert.equal(ruleApplies({ generations: { modern: true } }, 'modern'), true);
  assert.equal(ruleApplies({ generations: {} }, 'modern'), true);
});
