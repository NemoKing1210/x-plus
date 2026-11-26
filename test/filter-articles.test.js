import test from 'node:test';
import assert from 'node:assert/strict';
import { topLevelArticle } from '../src/features/filter/engine.js';

/** A node whose nearest article ancestor is `outer` (or none). */
const inside = (id, outer) => ({
  nodeType: 1,
  id,
  parentElement: { closest: (selector) => (selector === 'article' ? outer : null) },
});

test('topLevelArticle maps a quoted post to the post that holds it', () => {
  const outer = { nodeType: 1, id: 'outer', parentElement: { closest: () => null } };
  const quote = inside('quote', outer);
  assert.equal(topLevelArticle(quote), outer);
});

test('topLevelArticle keeps a post that is not quoted', () => {
  const post = { nodeType: 1, id: 'post', parentElement: { closest: () => null } };
  assert.equal(topLevelArticle(post), post);
});
