import assert from 'node:assert/strict';
import test from 'node:test';
import { focalArticleFor, plainText } from '../src/features/filter/facts.js';

const text = (value) => ({ nodeType: 3, nodeValue: value });

function element(tagName, childNodes = [], attrs = {}) {
  return {
    nodeType: 1,
    tagName,
    childNodes,
    matches: () => false,
    getAttribute: (name) => attrs[name] ?? null,
  };
}

test('plainText skips icon SVGs so a verified badge does not join a name', () => {
  const root = element('DIV', [
    text('NASA'),
    element('SVG', [text('Verified account')], { 'aria-label': 'Verified account' }),
  ]);

  assert.equal(plainText(root), 'nasa');
});

test('plainText keeps emoji alt text and aria labels', () => {
  const root = element('DIV', [
    text('Flag '),
    element('IMG', [], { alt: '🇺🇦' }),
    element('DIV', [text('ignored')], { role: 'img', 'aria-label': 'rocket' }),
  ]);

  assert.equal(plainText(root), 'flag 🇺🇦rocket');
});

test('the focal article is the first post of the primary column', () => {
  const reply = { id: 'reply' };
  let articles = [{ id: 'old' }, reply];
  const primary = { querySelectorAll: () => articles };
  const doc = { querySelector: () => primary };

  // SPA navigation: `navigate` runs while the old timeline is still mounted.
  assert.equal(focalArticleFor(doc, '/someone/status/1'), articles[0]);

  articles = [{ id: 'new' }, reply];
  assert.equal(focalArticleFor(doc, '/someone/status/2'), articles[0]);
});

test('only status pages have a focal article', () => {
  const doc = { querySelector: () => ({ querySelectorAll: () => [{ id: 'post' }] }) };
  assert.equal(focalArticleFor(doc, '/home'), null);
  assert.equal(focalArticleFor(doc, '/someone'), null);
});

test('a status page without a primary column has no focal article', () => {
  assert.equal(focalArticleFor({ querySelector: () => null }, '/someone/status/1'), null);
});
