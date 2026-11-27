import { domToBlob } from 'modern-screenshot';
import { dom } from '../../core/compat/index.js';
import { THEME_ATTR, UI_ATTR } from '../../core/constants.js';
import { Codes, fail } from '../../core/debug.js';
import { ensureOpaque, resolveBackground, solidColor } from './background.js';
import {
  CAPTURE_TIMEOUT_MS,
  JPEG_QUALITY,
  MAX_CANVAS_SIZE,
  cfg,
} from './config.js';
import { resolveScale } from './naming.js';

function postHandle(article) {
  return dom.getAuthorHandle(article) || '';
}

/**
 * The page color, not a card's: X paints the theme on <body>/<html> when it
 * paints it at all, and leaves the post article transparent. Falling back to
 * the article's ancestors covers clients that paint a wrapper instead.
 */
function pageBackground(article) {
  const roots = [document.body, document.documentElement];
  for (const node of roots) {
    if (!node) continue;
    const color = solidColor(getComputedStyle(node).backgroundColor);
    if (color) return color;
  }
  for (let node = article; node; node = node.parentElement) {
    const color = solidColor(getComputedStyle(node).backgroundColor);
    if (color) return color;
  }
  return '';
}

/** Theme mirrored by `core/theme.js`; dark is X's default. */
function pageTheme() {
  const theme = document.documentElement.getAttribute(THEME_ATTR);
  return theme === 'light' || theme === 'dim' ? theme : 'dark';
}

/** This post's own action row (not a quote card's or a nested article's). */
function findOwnActionRow(article) {
  return dom.getActionGroup(article);
}

/**
 * Height of everything above the action row. X renders that row last, so the
 * capture can be trimmed by its offset instead of leaving an empty gap.
 */
function trimmedHeight(article, row) {
  const box = article.getBoundingClientRect();
  const top = Math.ceil(row.getBoundingClientRect().top - box.top);
  return top > 0 && top < box.height ? top : 0;
}

/**
 * Our own chrome never belongs in the image. A video without a poster is also
 * skipped: the renderer captures a video by seeking it and waiting for
 * `seeked`, which never fires without a source, so the whole capture would
 * hang forever. Its player container keeps the block in place.
 */
function shouldSkip(node, hiddenRow) {
  if (!(node instanceof Element)) return false;
  if (node.matches(`[${UI_ATTR}]`)) return true;
  if (hiddenRow && node === hiddenRow) return true;
  return node instanceof HTMLVideoElement && !node.poster;
}

/**
 * Render one post article to an image blob, as it appears on the page.
 *
 * `overrides` lets the capture menu use a background / scale / action-row
 * choice for a single action without waiting for the settings round-trip.
 *
 * @param {Element} article
 * @param {{ format?: 'png'|'jpeg', background?: string, customBackground?: string, scale?: string, actions?: boolean }} [overrides]
 */
export async function capturePost(article, overrides = {}) {
  const settings = { ...cfg(), ...overrides };
  const format = settings.format === 'jpeg' ? 'jpeg' : 'png';
  const hiddenRow = settings.actions ? null : findOwnActionRow(article);
  const height = hiddenRow ? trimmedHeight(article, hiddenRow) : 0;
  const theme = pageTheme();
  const resolved = resolveBackground(
    settings.background,
    settings.customBackground,
    pageBackground(article),
    theme,
  );
  // JPEG has no alpha: a transparent choice becomes the theme color.
  const background = format === 'jpeg' ? ensureOpaque(resolved, theme) : resolved;

  const options = {
    type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
    ...(format === 'jpeg' ? { quality: JPEG_QUALITY } : {}),
    scale: resolveScale(settings.scale, window.devicePixelRatio),
    maximumCanvasSize: MAX_CANVAS_SIZE,
    timeout: CAPTURE_TIMEOUT_MS,
    backgroundColor: background,
    // An explicit transparent choice must win over any color X paints on the post.
    ...(background ? {} : { style: { backgroundColor: 'transparent' } }),
    ...(height > 0 ? { height } : {}),
    features: { restoreScrollPosition: false },
    filter: (node) => !shouldSkip(node, hiddenRow),
  };

  // A renderer that never settles must not leave the button disabled forever.
  let timer = 0;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('screenshot timed out')),
      CAPTURE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([domToBlob(article, options), deadline]);
  } catch (error) {
    throw fail(
      Codes.SCREENSHOT_FAILED,
      'post screenshot failed',
      { handle: postHandle(article) },
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}
