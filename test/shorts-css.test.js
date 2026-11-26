import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = readFileSync(fileURLToPath(new URL('../src/styles/shorts.css', import.meta.url)), 'utf8');

test('shorts styles the top-level post only, not the article inside a quote', () => {
  // A quote embed nests its own <article>: scaling and blurring it as well
  // doubles the transform and inherits the outer post's transform origin.
  assert.match(CSS, /article:not\(article article\)/);
  assert.doesNotMatch(CSS, /:is\(article\[data-testid='tweet'\], article\)/);
});

test('the post transition never animates filter', () => {
  // Animating `filter: blur()` re-rasterises the whole post every frame while
  // the feed scrolls; that was the main source of stutter while stepping.
  // The blur must switch at once instead (see docs/ARCHITECTURE.md).
  const base = CSS.match(/\[data-xp-shorts\] article:not\(article article\) \{([^}]*)\}/s)?.[1] ?? '';
  assert.match(base, /transition:/);
  assert.doesNotMatch(base, /filter/);
  // The three promoted posts do not reserve a filtered layer either.
  assert.doesNotMatch(CSS, /will-change:[^;]*filter/);
});
