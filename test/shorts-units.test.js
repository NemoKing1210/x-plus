import test from 'node:test';
import assert from 'node:assert/strict';

import { cellPosts } from '../src/features/shorts/units.js';

/** A fake article whose `parentElement.closest('article')` answers with `parent`. */
function article(parentArticle = null) {
  return { parentElement: { closest: (selector) => (selector === 'article' ? parentArticle : null) } };
}

test('a cell reports only its own posts', () => {
  // X may now draw a post and its reply inside one cell: both are posts of the cell.
  const post = article();
  const reply = article();
  assert.deepEqual(cellPosts([post, reply]), [post, reply]);
});

test('a quote embed is not a post of the cell', () => {
  // A quote nests its own <article> inside the post that quotes it.
  const outer = article();
  const quote = article(outer);
  assert.deepEqual(cellPosts([outer, quote]), [outer]);
});

test('a cell without posts yields nothing', () => {
  assert.deepEqual(cellPosts([]), []);
});

test('an article without a parent is still a post', () => {
  const orphan = { parentElement: null };
  assert.deepEqual(cellPosts([orphan]), [orphan]);
});
