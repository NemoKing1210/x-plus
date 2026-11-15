/**
 * Pure background rules for the screenshot feature. No DOM imports: the color
 * parsing and fallbacks are unit-tested in Node
 * (`test/screenshot-background.test.js`).
 */

/** X's page colors per theme (light | dim | lights-out). */
export const THEME_BACKGROUNDS = Object.freeze({
  light: '#ffffff',
  dim: '#15202b',
  dark: '#000000',
});

/** Background choices offered in settings (also i18n keys). */
export const BACKGROUND_MODES = Object.freeze([
  'theme',
  'white',
  'black',
  'transparent',
  'custom',
]);

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const RGB_RE =
  /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/;

function alphaOf(raw) {
  if (raw == null) return 1;
  if (raw.endsWith('%')) return Number.parseFloat(raw) / 100;
  return Number(raw);
}

/**
 * Normalize a CSS color to an opaque value, or `''` when it is missing,
 * transparent or semi-transparent. A transparent background is what made
 * screenshots look gray/checkerboarded in image viewers.
 * @param {unknown} value
 * @returns {string}
 */
export function solidColor(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'transparent') return '';
  if (raw === 'white') return '#ffffff';
  if (raw === 'black') return '#000000';

  if (HEX_RE.test(raw)) {
    const hex = raw.slice(1);
    if (hex.length === 3) return `#${hex}`;
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 4) return hex[3] === 'f' ? `#${hex.slice(0, 3)}` : '';
    return hex.slice(6) === 'ff' ? `#${hex.slice(0, 6)}` : '';
  }

  const match = raw.match(RGB_RE);
  if (!match) return '';
  if (alphaOf(match[4]) < 1) return '';
  const channels = [match[1], match[2], match[3]].map(Number);
  if (channels.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return '';
  return `rgb(${channels.map((n) => Math.round(n)).join(', ')})`;
}

/**
 * Effective canvas background for the capture.
 * @param {string} mode `theme` | `white` | `black` | `transparent` | `custom`
 * @param {string} custom user color, used by `custom`
 * @param {string} detected first opaque color found above the post
 * @param {string} theme `light` | `dim` | `dark`
 * @returns {string | null} CSS color, or `null` for a transparent PNG
 */
export function resolveBackground(mode, custom, detected, theme) {
  const themeColor = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS.dark;
  if (mode === 'transparent') return null;
  if (mode === 'white') return '#ffffff';
  if (mode === 'black') return '#000000';
  if (mode === 'custom') {
    return solidColor(custom) || solidColor(detected) || themeColor;
  }
  // `theme` (and any unknown value): the page color when X paints one,
  // otherwise the theme's own color. Never transparent.
  return solidColor(detected) || themeColor;
}
