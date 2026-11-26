import test from 'node:test';
import assert from 'node:assert/strict';
import { keyHint, keyLabel } from '../src/utils/keys.js';

test('a key hint appends the readable key to the label', () => {
  assert.equal(keyHint('Next post', 'KeyJ'), 'Next post (J)');
  assert.equal(keyHint('Previous post', 'ArrowUp'), 'Previous post (↑)');
});

test('a missing key leaves the label alone', () => {
  assert.equal(keyHint('Next post', ''), 'Next post');
  assert.equal(keyHint('Next post', null), 'Next post');
});

test('key labels stay readable for letters, digits and arrows', () => {
  assert.equal(keyLabel('KeyP'), 'P');
  assert.equal(keyLabel('Digit1'), '1');
  assert.equal(keyLabel('ArrowDown'), '↓');
});
