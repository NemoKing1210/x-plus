/**
 * X sets theme via color-scheme / background on <html>, and sometimes
 * `data-color-mode` / class tokens. Mirror into data-xp-theme for our UI (see THEME_ATTR).
 *
 * Themes: light | dim (#15202b) | dark / lights-out (#000).
 */

import { THEME_ATTR } from './constants.js';

/** @typedef {'light' | 'dim' | 'dark'} XpTheme */

function luminanceFromRgb(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function parseBgRgb(bg) {
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return null;
  const rgb = bg.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return null;
  return {
    r: Number(rgb[1]),
    g: Number(rgb[2]),
    b: Number(rgb[3]),
  };
}

function parseBgLuminance(bg) {
  const rgb = parseBgRgb(bg);
  if (!rgb) return null;
  return luminanceFromRgb(rgb.r, rgb.g, rgb.b);
}

/**
 * Classify a page background into X’s three themes.
 * Dim (~#15202b) sits between near-black lights-out and light.
 * @returns {XpTheme | null}
 */
function themeFromBackground(bg) {
  const rgb = parseBgRgb(bg);
  if (!rgb) return null;
  const lum = luminanceFromRgb(rgb.r, rgb.g, rgb.b);
  if (lum > 0.55) return 'light';
  // Near-black lights out
  if (lum < 0.04) return 'dark';
  // Dim blue-gray band (typical #15202b ≈ lum 0.11)
  if (lum >= 0.04 && lum <= 0.28) {
    // Prefer dim when blue channel is competitive (X dim is cool navy)
    if (rgb.b >= rgb.r - 5) return 'dim';
    return 'dark';
  }
  return 'dark';
}

function explicitThemeToken(raw) {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  if (v === 'light' || v === 'dim' || v === 'dark') return v;
  if (v === 'lights-out' || v === 'lightsout' || v === 'black') return 'dark';
  return null;
}

/** @returns {XpTheme} */
export function detectPageTheme() {
  const root = document.documentElement;
  const body = document.body;

  const explicit =
    explicitThemeToken(root.getAttribute('data-color-mode')) ||
    explicitThemeToken(root.getAttribute('data-theme')) ||
    explicitThemeToken(body?.getAttribute?.('data-color-mode')) ||
    explicitThemeToken(body?.getAttribute?.('data-theme'));
  if (explicit) return explicit;

  const classBlob = `${root.className || ''} ${body?.className || ''}`.toLowerCase();
  if (/\bdim\b/.test(classBlob)) return 'dim';
  if (/\blights?-?out\b/.test(classBlob)) return 'dark';

  for (const el of [body, root]) {
    if (!el) continue;
    const fromBg = themeFromBackground(getComputedStyle(el).backgroundColor);
    if (fromBg) return fromBg;
  }

  const scheme = getComputedStyle(root).colorScheme || '';
  if (/\blight\b/i.test(scheme) && !/\bdark\b/i.test(scheme)) return 'light';
  if (/\bdark\b/i.test(scheme) && !/\blight\b/i.test(scheme)) return 'dark';

  if (window.matchMedia?.('(prefers-color-scheme: light)')?.matches) return 'light';
  return 'dark';
}

/** @param {XpTheme} [theme] */
export function applyPageTheme(theme = detectPageTheme()) {
  const next = theme === 'light' || theme === 'dim' ? theme : 'dark';
  if (document.documentElement.getAttribute(THEME_ATTR) !== next) {
    document.documentElement.setAttribute(THEME_ATTR, next);
  }
  return next;
}

/** Watch X theme flips on <html>/<body>. */
export function observePageTheme(onChange) {
  let last = applyPageTheme();
  onChange?.(last);

  const run = () => {
    const next = applyPageTheme();
    if (next !== last) {
      last = next;
      onChange?.(next);
    }
  };

  const observer = new MutationObserver(run);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-color-mode', 'data-theme'],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-color-mode', 'data-theme'],
    });
  }

  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  mql?.addEventListener?.('change', run);

  return () => {
    observer.disconnect();
    mql?.removeEventListener?.('change', run);
  };
}
