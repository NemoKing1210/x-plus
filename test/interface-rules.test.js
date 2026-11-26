import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupApplies, ruleApplies } from '../src/features/interface/rule-applies.js';
import { cssFor } from '../src/core/compat/index.js';
import { RULES, ruleId } from '../src/features/interface/rules.js';

test('a legacy-only rule is skipped on modern', () => {
  const rule = { key: 'legacyThing', generations: { modern: false } };
  assert.equal(ruleApplies(rule, 'modern'), false);
  assert.equal(ruleApplies(rule, 'legacy'), true);
  assert.equal(ruleApplies({ key: 'all' }, 'modern'), true);
});

test('a rule with no modern target is marked legacy-only', () => {
  // The "Show N posts" marker only exists on the legacy build. Without the
  // marker the switch would be visible and do nothing, so it must be hidden.
  const rule = RULES.find((entry) => entry.key === 'showPosts');
  assert.equal(ruleApplies(rule, 'modern'), false);
  assert.equal(ruleApplies(rule, 'legacy'), true);
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

test('the logo rule climbs past a spacer without an <h1> on the modern home column', () => {
  const link = { closest: () => null, querySelector: () => ({}) };
  const spacer = { querySelectorAll: (selector) => (selector === 'a[href], button' ? [link] : []) };
  const column = { querySelectorAll: () => new Array(16) };
  spacer.parentElement = column;
  column.parentElement = null;
  link.parentElement = spacer;
  const root = { querySelectorAll: (selector) => (selector === 'a[href="/home"]' ? [link] : []) };
  const rule = RULES.find((candidate) => ruleId(candidate) === 'nav.logo');
  assert.equal(rule.find(root)[0], spacer);
});

test('the discover-more block starts at a heading cell that also holds a post', () => {
  const focal = { nodeType: 1 };
  const recommended = { nodeType: 1 };
  const later = { nodeType: 1 };
  const heading = { nodeType: 1, closest: () => null };
  const cell = (post, headings = []) => ({
    nodeType: 1,
    post,
    headings,
    querySelector: (selector) => (selector === 'article' ? post : null),
    querySelectorAll: (selector) => (selector === 'h1, h2' ? headings : []),
    contains: () => false,
  });
  const focalCell = cell(focal);
  const headingCell = cell(recommended, [heading]);
  const laterCell = cell(later);
  const cells = [focalCell, headingCell, laterCell];
  const primary = {
    nodeType: 1,
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === 'li[data-index]' ? cells : []),
  };
  const root = {
    nodeType: 1,
    isConnected: true,
    querySelector: (selector) => (selector === 'main' ? primary : null),
    contains: () => true,
  };

  const saved = { document: globalThis.document, location: globalThis.location };
  globalThis.document = root;
  globalThis.location = { pathname: '/jack/status/20' };
  try {
    const rule = RULES.find((candidate) => ruleId(candidate) === 'posts.moreFromX');
    assert.deepEqual(rule.find(root), [headingCell, laterCell]);
  } finally {
    if (saved.document === undefined) delete globalThis.document;
    else globalThis.document = saved.document;
    if (saved.location === undefined) delete globalThis.location;
    else globalThis.location = saved.location;
  }
});

test('feed suggestions are found without a heading role, merged with the accounts', () => {
  const heading = { nodeType: 1, closest: () => null };
  const userCell = { nodeType: 1 };
  const suggestions = {
    nodeType: 1,
    querySelector: (selector) => {
      if (selector === 'article') return null;
      if (selector === cssFor('userCell')) return userCell;
      return null;
    },
    querySelectorAll: (selector) => (selector === 'h1, h2' ? [heading] : []),
    contains: () => true,
  };
  const primary = {
    nodeType: 1,
    isConnected: true,
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === 'li[data-index]' ? [suggestions] : []),
  };
  const root = {
    nodeType: 1,
    isConnected: true,
    querySelector: (selector) => (selector === 'main' ? primary : null),
    contains: () => true,
  };

  const savedDocument = globalThis.document;
  globalThis.document = root;
  try {
    const rule = RULES.find((candidate) => ruleId(candidate) === 'posts.whoToFollow');
    assert.deepEqual(rule.find(root), [suggestions]);
  } finally {
    if (savedDocument === undefined) delete globalThis.document;
    else globalThis.document = savedDocument;
  }
});
