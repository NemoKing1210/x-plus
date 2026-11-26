import test from 'node:test';
import assert from 'node:assert/strict';
import { detectGeneration } from '../src/core/compat/detect.js';

const root = (...hits) => ({
  querySelector: (selector) => (hits.some((hit) => selector.includes(hit)) ? {} : null),
});
const profile = (id, marker) => ({
  id,
  detect: (r) => Boolean(r.querySelector(`[data-${marker}]`)),
});

test('returns the first matching profile in priority order', () => {
  const modern = profile('modern', 'engagement-action');
  const legacy = profile('legacy', 'testid');
  assert.equal(detectGeneration(root('data-engagement-action', 'data-testid'), [modern, legacy]), 'modern');
  assert.equal(detectGeneration(root('data-testid'), [modern, legacy]), 'legacy');
});

test('returns unknown when no probe matches', () => {
  assert.equal(detectGeneration(root(), [profile('modern', 'x'), profile('legacy', 'y')]), 'unknown');
});

test('a throwing probe does not block the next profile', () => {
  const broken = { id: 'broken', detect: () => { throw new Error('bad selector'); } };
  const legacy = profile('legacy', 'testid');
  assert.equal(detectGeneration(root('data-testid'), [broken, legacy]), 'legacy');
});
