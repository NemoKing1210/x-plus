import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOpaque,
  resolveBackground,
  solidColor,
  THEME_BACKGROUNDS,
  toHexColor,
} from '../src/features/screenshot/background.js';

test('solidColor accepts opaque CSS colors only', () => {
  assert.equal(solidColor('#000000'), '#000000');
  assert.equal(solidColor('#FFF'), '#fff');
  assert.equal(solidColor('#15202B'), '#15202b');
  assert.equal(solidColor('#000000ff'), '#000000');
  assert.equal(solidColor('#fffF'), '#fff');
  assert.equal(solidColor('rgb(21, 32, 43)'), 'rgb(21, 32, 43)');
  assert.equal(solidColor('rgba(255, 255, 255, 1)'), 'rgb(255, 255, 255)');
  assert.equal(solidColor('rgba(255, 255, 255, 1.0)'), 'rgb(255, 255, 255)');
  assert.equal(solidColor('white'), '#ffffff');
  assert.equal(solidColor('black'), '#000000');
});

test('solidColor rejects transparent and semi-transparent values', () => {
  assert.equal(solidColor('transparent'), '');
  assert.equal(solidColor('rgba(0, 0, 0, 0)'), '');
  assert.equal(solidColor('rgba(255, 255, 255, 0.5)'), '');
  assert.equal(solidColor('#00000080'), '');
  assert.equal(solidColor('#0000'), '');
  assert.equal(solidColor('color(srgb 0 0 0)'), '');
  assert.equal(solidColor('red'), '');
  assert.equal(solidColor(''), '');
  assert.equal(solidColor(null), '');
  assert.equal(solidColor(undefined), '');
});

test('theme background is always opaque, even when X paints nothing', () => {
  assert.equal(resolveBackground('theme', '', '', 'dark'), '#000000');
  assert.equal(resolveBackground('theme', '', '', 'dim'), '#15202b');
  assert.equal(resolveBackground('theme', '', '', 'light'), '#ffffff');
  assert.equal(resolveBackground('theme', '', '', 'unknown'), '#000000');
  assert.equal(resolveBackground('theme', '', 'rgba(0, 0, 0, 0)', 'light'), '#ffffff');
});

test('theme background prefers the first opaque page color', () => {
  assert.equal(
    resolveBackground('theme', '', 'rgb(10, 20, 30)', 'light'),
    'rgb(10, 20, 30)',
  );
  assert.equal(
    resolveBackground('theme', 'rgb(1, 2, 3)', 'rgb(10, 20, 30)', 'light'),
    'rgb(10, 20, 30)',
  );
});

test('explicit background modes override the page color', () => {
  assert.equal(resolveBackground('white', '', 'rgb(10, 20, 30)', 'dark'), '#ffffff');
  assert.equal(resolveBackground('black', '', 'rgb(10, 20, 30)', 'light'), '#000000');
  assert.equal(resolveBackground('transparent', '', 'rgb(10, 20, 30)', 'light'), null);
});

test('custom background falls back to the theme color when invalid', () => {
  assert.equal(resolveBackground('custom', '#123456', '', 'light'), '#123456');
  assert.equal(resolveBackground('custom', 'not-a-color', '', 'dim'), '#15202b');
  assert.equal(
    resolveBackground('custom', 'not-a-color', 'rgb(9, 9, 9)', 'light'),
    'rgb(9, 9, 9)',
  );
});

test('theme map matches X colors', () => {
  assert.deepEqual(THEME_BACKGROUNDS, {
    light: '#ffffff',
    dim: '#15202b',
    dark: '#000000',
  });
});

test('ensureOpaque replaces a transparent background for JPEG', () => {
  assert.equal(ensureOpaque(null, 'light'), '#ffffff');
  assert.equal(ensureOpaque(null, 'dim'), '#15202b');
  assert.equal(ensureOpaque(null, 'dark'), '#000000');
  assert.equal(ensureOpaque('', 'unknown'), '#000000');
  assert.equal(ensureOpaque('#123456', 'light'), '#123456');
});

test('toHexColor feeds a color input', () => {
  assert.equal(toHexColor('#15202b'), '#15202b');
  assert.equal(toHexColor('#FFF'), '#ffffff');
  assert.equal(toHexColor('rgb(21, 32, 43)'), '#15202b');
  assert.equal(toHexColor('rgba(0, 0, 0, 1)'), '#000000');
  assert.equal(toHexColor('transparent'), '#000000');
  assert.equal(toHexColor('nonsense'), '#000000');
});
