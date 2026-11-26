import test from 'node:test';
import assert from 'node:assert/strict';
import { postsCss, POSTS_PEEK_ATTR } from '../src/features/interface/posts.js';
import { cssFor } from '../src/core/compat/index.js';

test('cards colour the post surface, not the inner article', () => {
  const css = postsCss({ cards: true, cardStyle: 'filled', cardRadius: 16, cardOpacity: 50 });
  const rule = css.split('\n').find((line) => line.includes('border-radius:16px!important'));
  assert.ok(rule, 'a card rule is emitted');
  assert.ok(
    rule.startsWith(`html:not([${POSTS_PEEK_ATTR}]) ${cssFor('primaryColumn')} ${cssFor('postSurface')}{`),
    `card rule targets the surface: ${rule}`,
  );
});

test('cards keep the per-generation radius off the cell itself', () => {
  const css = postsCss({ cards: true, cardStyle: 'outline', cardRadius: 8, cardOpacity: 100 });
  assert.ok(!css.includes(`${cssFor('cell')}{border-radius`), 'no radius on the cell');
});
