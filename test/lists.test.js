import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHandleList, normalizeLangCode, normalizeLangList } from '../src/utils/lists.js';

test('language codes are trimmed, lower-cased and use dashes', () => {
  assert.equal(normalizeLangCode(' PT_BR '), 'pt-br');
  assert.equal(normalizeLangCode(null), '');
});

test('language lists are deduplicated and sorted', () => {
  assert.deepEqual(normalizeLangList(['EN', 'en', 'fr', 'de']), ['de', 'en', 'fr']);
  assert.deepEqual(normalizeLangList('en'), []);
});

test('handle lists drop invalid entries and sort', () => {
  assert.deepEqual(normalizeHandleList(['@B', 'a', 'home', 'b']), ['a', 'b']);
  assert.deepEqual(normalizeHandleList(null), []);
});
