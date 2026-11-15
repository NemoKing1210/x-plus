import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureScale,
  postFileName,
  resolveScale,
  statusIdFromHref,
} from '../src/features/screenshot/naming.js';

test('captureScale clamps the device pixel ratio', () => {
  assert.equal(captureScale(1), 2);
  assert.equal(captureScale(2), 2);
  assert.equal(captureScale(2.5), 2.5);
  assert.equal(captureScale(4), 3);
  assert.equal(captureScale(0), 2);
  assert.equal(captureScale(undefined), 2);
});

test('resolveScale follows an explicit setting and auto otherwise', () => {
  assert.equal(resolveScale('1', 3), 1);
  assert.equal(resolveScale('2', 1), 2);
  assert.equal(resolveScale('3', 1), 3);
  assert.equal(resolveScale('auto', 2.5), 2.5);
  assert.equal(resolveScale('auto', 4), 3);
  assert.equal(resolveScale('bogus', 1), 2);
});

test('statusIdFromHref finds the post id only in status links', () => {
  assert.equal(
    statusIdFromHref('/elonmusk/status/1585341984679469056'),
    '1585341984679469056',
  );
  assert.equal(
    statusIdFromHref('/elonmusk/status/1585341984679469056/analytics'),
    '1585341984679469056',
  );
  assert.equal(statusIdFromHref('/elonmusk'), '');
  assert.equal(statusIdFromHref(null), '');
});

test('postFileName builds a safe file name', () => {
  assert.equal(postFileName('jack', '20'), 'x-plus-post-jack-20.png');
  assert.equal(postFileName('', '20'), 'x-plus-post-post-20.png');
  assert.equal(postFileName('A/B', '20'), 'x-plus-post-ab-20.png');
  assert.equal(postFileName('jack', ''), 'x-plus-post-jack-post.png');
});
