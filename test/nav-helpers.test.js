import test from 'node:test';
import assert from 'node:assert/strict';
import { navUsesHoverClass } from '../src/core/compat/profiles/shared.js';

test('the legacy build toggles the nav hover pill class from JS', () => {
  assert.equal(navUsesHoverClass('legacy'), true);
  assert.equal(navUsesHoverClass('unknown'), true);
  assert.equal(navUsesHoverClass(''), true);
});

test('the modern build styles the nav row with CSS', () => {
  assert.equal(navUsesHoverClass('modern'), false);
});
