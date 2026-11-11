import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHandleDisplay, handleFromHref, normalizeHandle } from '../src/utils/handle.js';

test('normalizeHandle accepts handles and profile URLs', () => {
  assert.equal(normalizeHandle('@User_Name'), 'user_name');
  assert.equal(normalizeHandle('  user  '), 'user');
  assert.equal(normalizeHandle('https://x.com/SomeOne'), 'someone');
  assert.equal(normalizeHandle('https://twitter.com/someone/status/123'), 'someone');
  assert.equal(normalizeHandle('/someone?ref=1'), 'someone');
  assert.equal(normalizeHandle('@someone/'), 'someone');
});

test('normalizeHandle rejects reserved paths and invalid values', () => {
  assert.equal(normalizeHandle('home'), '');
  assert.equal(normalizeHandle('/settings'), '');
  assert.equal(normalizeHandle('a'.repeat(16)), '');
  assert.equal(normalizeHandle('bad-handle'), '');
  assert.equal(normalizeHandle(''), '');
});

test('handleFromHref / formatHandleDisplay', () => {
  assert.equal(handleFromHref('/someone/status/1'), 'someone');
  assert.equal(handleFromHref('https://x.com/someone'), 'someone');
  assert.equal(handleFromHref(''), '');
  assert.equal(formatHandleDisplay('@User'), '@user');
  assert.equal(formatHandleDisplay('home'), '');
});
