import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

const appFiles = [...walk(join(SRC, 'features')), ...walk(join(SRC, 'ui'))];
const read = (file) => readFileSync(file, 'utf8');
const rel = (file) => relative(SRC, file).replaceAll('\\', '/');

/** The one feature file allowed to keep a legacy `r-*` class (learned at runtime, see DEVELOPMENT.md). */
const HOVER_SEED_EXCEPTION = 'features/settings/nav-button.js';

test('features and ui import the compat API, never a DOM profile', () => {
  for (const file of appFiles) {
    assert.ok(!/compat\/profiles\//.test(read(file)), `${rel(file)} imports a DOM profile directly`);
  }
});

test('features and ui carry no X selector of their own', () => {
  const X_SELECTOR = /data-testid|xds-|header\[role="banner"\]|\.r-[a-z0-9]{5,}/;
  for (const file of appFiles) {
    if (rel(file) === HOVER_SEED_EXCEPTION) continue;
    assert.ok(!X_SELECTOR.test(read(file)), `${rel(file)} carries an X selector`);
  }
});

test('the documented exception is the only place with an atomic class', () => {
  assert.ok(/r-[a-z0-9]{5,}/.test(read(join(SRC, HOVER_SEED_EXCEPTION))));
});

test('constants.js no longer re-exports profile internals', () => {
  const text = read(join(SRC, 'core/constants.js'));
  assert.ok(!/\bSEL\b/.test(text));
  assert.ok(!text.includes('QUOTE_HEADER_ROW_SELECTOR'));
  assert.ok(!text.includes('NATIVE_AUTO_TRANSLATE_ICON_PATH'));
});
