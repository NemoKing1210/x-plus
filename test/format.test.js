import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatBitrate,
  formatBytes,
  fmt,
  sanitizeFileName,
} from '../src/utils/format.js';

test('fmt substitutes placeholders and drops missing ones', () => {
  assert.equal(fmt('{a} {b}', { a: 'x', b: 2 }), 'x 2');
  assert.equal(fmt('{a}{missing}', { a: 'x' }), 'x');
});

test('byte and bitrate formatting', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1024 * 1024), '1.00 MB');
  assert.equal(formatBytes('nope'), '0 B');
  assert.equal(formatBitrate(0), '');
  assert.equal(formatBitrate(2_500_000), '2.5 Mbps');
  assert.equal(formatBitrate(500_000), '0.50 Mbps');
});

test('file names are sanitized for every platform', () => {
  assert.equal(sanitizeFileName('a/b:c*?"<>|'), 'a_b_c______');
  assert.equal(sanitizeFileName('  ..name..  '), 'name');
  assert.equal(sanitizeFileName(''), 'file');
  assert.equal(sanitizeFileName('x'.repeat(200), 10), 'x'.repeat(10));
  assert.equal(sanitizeFileName(' a   b '), 'a b');
});
