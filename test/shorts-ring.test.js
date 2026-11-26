import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_LENGTH, ringOffset, ringVisible } from '../src/features/shorts/ring.js';

test('the auto-scroll ring shows only while the countdown runs', () => {
  assert.equal(ringVisible({ progress: 0, paused: false }), true);
  assert.equal(ringVisible({ progress: 0.4, paused: false }), true);
});

test('a stopped or paused countdown shows no ring', () => {
  assert.equal(ringVisible(null), false);
  assert.equal(ringVisible({ progress: 0, paused: true }), false);
  assert.equal(ringVisible({ progress: 0.4, paused: true }), false);
});

test('the arc offset follows the progress along the ring', () => {
  assert.equal(ringOffset(0), RING_LENGTH);
  assert.equal(ringOffset(1), 0);
  assert.equal(Math.round(ringOffset(0.25)), Math.round(RING_LENGTH * 0.75));
});
