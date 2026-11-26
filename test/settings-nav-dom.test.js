import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNavIcon, applyNavLabel, navRowNeedsRebuild } from '../src/features/settings/nav-dom.js';

function leaf(text) {
  return {
    children: [],
    textContent: text,
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    querySelector: () => null,
  };
}

test('the modern label is the leaf span, not the pill that wraps the icon', () => {
  const label = leaf('Explore');
  const pill = {
    children: [{}, {}],
    textContent: 'Explore',
    querySelector: () => ({}),
    setAttribute() {},
  };
  const iconWrap = { children: [{}], textContent: '', querySelector: () => ({}) };
  const root = {
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === 'span' ? [pill, iconWrap, label] : []),
  };

  assert.equal(applyNavLabel(root, 'X Plus'), label);
  assert.equal(label.textContent, 'X Plus');
  assert.equal(label.attributes['data-xp-nav-label'], '1');
  assert.equal(pill.textContent, 'Explore', 'the pill keeps its icon and label');
});

test('the legacy label stays the span inside div[dir]', () => {
  const span = leaf('More');
  const div = { querySelector: (selector) => (selector === ':scope > span' ? span : null) };
  const root = {
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === 'div[dir]' ? [div] : selector === 'span' ? [span] : []),
  };

  assert.equal(applyNavLabel(root, 'X Plus'), span);
  assert.equal(span.textContent, 'X Plus');
});

test('every icon state variant becomes the plus glyph', () => {
  const svg = () => ({
    attributes: {},
    innerHTML: '',
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
  });
  const first = svg();
  const second = svg();
  const root = { querySelectorAll: (selector) => (selector === 'svg' ? [first, second] : []) };

  applyNavIcon(root);

  for (const node of [first, second]) {
    assert.match(node.innerHTML, /^<g><path d="[^"]+"><\/path><\/g>$/);
    assert.equal(node.attributes.viewBox, '0 0 24 24');
    assert.equal(node.attributes['aria-hidden'], 'true');
  }
});

test('a row whose marked label still wraps the icon is rebuilt', () => {
  // Rows built before the modern label fix carry the mark on the pill.
  const pill = { children: [{}, {}] };
  const btn = { dataset: { xpNavOk: '1' }, querySelector: (selector) => (selector === '[data-xp-nav-label]' ? pill : null) };
  assert.equal(navRowNeedsRebuild(btn), true);
});

test('a healthy marked row is left alone', () => {
  const label = { children: [] };
  const btn = {
    dataset: {},
    querySelector: (selector) =>
      selector === '[data-xp-nav-label]' ? label : selector === 'svg' ? {} : null,
  };
  assert.equal(navRowNeedsRebuild(btn), false);
  assert.equal(btn.dataset.xpNavOk, '1');
});

test('a row without our mark or icon is rebuilt', () => {
  const btn = { dataset: {}, querySelector: () => null };
  assert.equal(navRowNeedsRebuild(btn), true);
});

test('a row whose icon was wiped by the old label code is rebuilt', () => {
  // Rows built before the fix lost the icon: the label mark sits on the pill and no svg is left.
  const pill = { children: [], textContent: 'X Plus' };
  const btn = {
    dataset: { xpNavOk: '1' },
    querySelector: (selector) => (selector === '[data-xp-nav-label]' ? pill : null),
  };
  assert.equal(navRowNeedsRebuild(btn), true);
});
