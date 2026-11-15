import { domToBlob } from 'modern-screenshot';
import { SEL, THEME_ATTR, UI_ATTR } from '../../core/constants.js';
import { Codes, fail } from '../../core/debug.js';
import { handleFromHref } from '../../utils/handle.js';
import { resolveBackground, solidColor } from './background.js';
import { CAPTURE_TIMEOUT_MS, MAX_CANVAS_SIZE, cfg } from './config.js';
import { resolveScale } from './naming.js';

/** Post identity selector (the X-specific rule lives at the top of the module). */
const USER_NAME = '[data-testid="User-Name"]';
/** X's action row (reply / repost / like / views) is the group holding Reply. */
const ACTION_GROUP = '[role="group"]';

function postHandle(article) {
  const link = article.querySelector(`${USER_NAME} a[href^="/"]`);
  return handleFromHref(link?.getAttribute('href')) || '';
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
  return (
    [...article.querySelectorAll(ACTION_GROUP)].find(
      (node) =>
        node.closest(SEL.article) === article &&
        Boolean(node.querySelector(SEL.actionReply)) &&
        !node.closest(SEL.quoteTweet),
    ) || null
  );
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

/** Render one post article to a PNG blob, as it appears on the page. */
export async function capturePost(article) {
  const settings = cfg();
  const hiddenRow = settings.actions ? null : findOwnActionRow(article);
  const height = hiddenRow ? trimmedHeight(article, hiddenRow) : 0;
  const background = resolveBackground(
    settings.background,
    settings.customBackground,
    pageBackground(article),
    pageTheme(),
  );

  const options = {
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
