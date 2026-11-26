import test from 'node:test';
import assert from 'node:assert/strict';
import { combinedCss, union } from '../src/core/compat/css.js';

const profile = (id, css) => ({ id, css });

test('union collapses one selector and wraps many', () => {
  assert.equal(union(['article']), 'article');
  assert.equal(union(['article[data-testid="tweet"]', 'article']), ':is(article[data-testid="tweet"], article)');
});

test('combinedCss reads the same key from every profile', () => {
  const profiles = [profile('modern', { article: 'article' }), profile('legacy', { article: 'article[data-testid="tweet"]' })];
  assert.equal(combinedCss(profiles, 'article'), ':is(article, article[data-testid="tweet"])');
});
