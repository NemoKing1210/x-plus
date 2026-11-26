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

test('the floating Grok and chat panels are hidden on both generations', () => {
  for (const key of ['grokDrawer', 'chatDrawer']) {
    const rule = RULES.find((candidate) => ruleId(candidate) === `chrome.${key}`);
    assert.equal(ruleApplies(rule, 'modern'), true, `chrome.${key} on modern`);
    assert.equal(ruleApplies(rule, 'legacy'), true, `chrome.${key} on legacy`);
  }
});

test('the logo rule maps to a wrapper only while it holds the logo alone', () => {
  const logoRoot = (linkCount) => {
    const wrapper = { querySelectorAll: () => Array.from({ length: linkCount }) };
    const heading = { parentElement: wrapper };
    const link = { closest: () => heading, querySelector: () => ({}) };
    const nav = {
      querySelector: (selector) => (selector === 'a[href="/home"]' ? link : null),
      querySelectorAll: (selector) => (selector === 'a[href="/home"]' ? [link] : []),
    };
    return { wrapper, heading, root: { querySelectorAll: (selector) => (selector === 'nav' ? [nav] : []) } };
  };
  const rule = RULES.find((candidate) => ruleId(candidate) === 'nav.logo');

  const legacy = logoRoot(1);
  assert.equal(rule.find(legacy.root)[0], legacy.wrapper);

  // The modern nav column wraps every row in the <h1>'s parent: hide only the logo row.
  const modern = logoRoot(16);
  assert.equal(rule.find(modern.root)[0], modern.heading);
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
