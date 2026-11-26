import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupApplies, ruleApplies } from '../src/features/interface/rule-applies.js';
import { RULES, ruleId } from '../src/features/interface/rules.js';

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

test('a group is on when at least one of its rules applies', () => {
  const rules = [
    { group: 'chrome', key: 'a', generations: { modern: false } },
    { group: 'chrome', key: 'b', generations: { modern: false } },
    { group: 'posts', key: 'c' },
  ];
  assert.equal(groupApplies(rules, 'chrome', 'modern'), false);
  assert.equal(groupApplies(rules, 'chrome', 'legacy'), true);
  assert.equal(groupApplies(rules, 'posts', 'modern'), true);
  assert.equal(groupApplies(rules, 'nav', 'modern'), false);
});

test('every rule can hide something on at least one generation', () => {
  for (const rule of RULES) {
    assert.ok(rule.css || rule.find || rule.inArticle, `${ruleId(rule)} has no target`);
    for (const selector of [].concat(rule.css || [])) {
      assert.ok(selector.trim(), `${ruleId(rule)} has an empty selector`);
    }
  }
});

test('rules.js builds its selectors from profile fragments', () => {
  const source = readFileSync(new URL('../src/features/interface/rules.js', import.meta.url), 'utf8');
  assert.ok(!/data-testid|xds-|header\[role="banner"\]/.test(source));
});
