import assert from 'node:assert/strict';
import test from 'node:test';
import { focalArticleFor } from '../src/features/filter/facts.js';

test('the focal article is resolved on every call, never cached', () => {
  const oldTimelinePost = { id: 'old' };
  const realFocalPost = { id: 'new' };
  let current = oldTimelinePost;
  const doc = { querySelector: () => current };

  // SPA navigation: `navigate` runs while the old timeline is still mounted.
  assert.equal(focalArticleFor(doc, '/someone/status/1'), oldTimelinePost);

  // X then renders the real focal post; the next read must see it.
  current = realFocalPost;
  assert.equal(focalArticleFor(doc, '/someone/status/1'), realFocalPost);
});

test('only status pages have a focal article', () => {
  const doc = { querySelector: () => ({ id: 'post' }) };
  assert.equal(focalArticleFor(doc, '/home'), null);
  assert.equal(focalArticleFor(doc, '/someone'), null);
});
