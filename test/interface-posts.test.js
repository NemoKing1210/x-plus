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

test('the gap moves the card itself on the modern build', () => {
  const css = postsCss({ gap: 10 });
  const rule = css.split('\n').find((line) => line.includes('margin-top:5px!important'));
  assert.ok(rule, `a margin gap rule is emitted: ${css}`);
  assert.ok(
    rule.startsWith(`html:not([${POSTS_PEEK_ATTR}]) ${cssFor('primaryColumn')} ${cssFor('postGapMargin')}{`),
    `gap rule targets the surface: ${rule}`,
  );
});

test('the legacy gap still pads the wrapper inside the cell', () => {
  const css = postsCss({ gap: 10 });
  const rule = css.split('\n').find((line) => line.includes('padding-top:5px!important'));
  assert.ok(rule, `a padding gap rule is emitted: ${css}`);
  assert.ok(
    rule.startsWith(`html:not([${POSTS_PEEK_ATTR}]) ${cssFor('primaryColumn')} ${cssFor('postGapPad')}{`),
    `gap rule targets the legacy wrapper: ${rule}`,
  );
});

test('no gap rule pads the modern surface it would sit inside the card', () => {
  const css = postsCss({ gap: 10 });
  assert.ok(!css.includes(`${cssFor('cell')} div:has(`), 'no cell-scoped padding rule is emitted');
});
