import { SEL } from '../core/constants.js';

/**
 * Boot transition. The page is frosted for a moment while the features apply
 * their settings and inject their chrome, then the veil lifts and the posts
 * that are on screen resolve in a short wave. Without it every injected button
 * and layout change appears in one abrupt frame right after the script loads.
 *
 * The veil itself is drawn by `styles/motion.css` on <html>::before, so it
 * needs no DOM of its own and follows the detected X theme.
 */

/** Attribute driving the veil (set on <html>). Mirrored in motion.css. */
const BOOT_ATTR = 'data-xp-booting';
const SHORTS_ATTR = 'data-xp-shorts-on';

/** Keep the veil up long enough to read as a transition, not as a flicker. */
const MIN_VISIBLE_MS = 400;
/** Stop waiting for X's first posts after this long and reveal anyway. */
const CONTENT_WAIT_MS = 800;
/** Matches the veil fade-out transition. */
const VEIL_OUT_MS = 420;
/** Delay between two posts of the reveal wave. */
const STAGGER_MS = 45;
/** Only the first screenful is staggered — the rest is not being looked at. */
const MAX_CASCADE = 12;
/** Last-resort removal if the page never reaches `boot()` (e.g. DOMContentLoaded never fires). */
const WATCHDOG_MS = 6000;

/** When the veil went up (module-level: it starts at document-start, boot follows later). */
let startedAt = 0;
let watchdog = 0;
/** The watchdog dropped the veil: boot must not put it back. */
let expired = false;

const prefersReducedMotion = () =>
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/**
 * Put the veil up as early as possible. Called at script start (document-start)
 * so it covers X's very first paint; `boot()` then applies everything under it.
 * @returns {boolean} whether the veil is running
 */
export function startBootVeil() {
  const root = document.documentElement;
  if (
    expired ||
    !root ||
    root.hasAttribute(BOOT_ATTR) ||
    prefersReducedMotion() ||
    document.readyState !== 'loading'
  ) {
    return false;
  }

  startedAt = performance.now();
  root.setAttribute(BOOT_ATTR, 'on');
  watchdog = setTimeout(() => {
    expired = true;
    root.removeAttribute(BOOT_ATTR);
  }, WATCHDOG_MS);
  return true;
}

function isOnScreen(node) {
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

/** Soft entrance for the posts that are on screen when the veil lifts. */
function cascadePosts() {
  const root = document.documentElement;
  // Shorts mode animates these same articles (scale / blur / opacity): skip it.
  if (root.hasAttribute(SHORTS_ATTR)) return;

  const posts = [...document.querySelectorAll(`${SEL.primaryColumn} ${SEL.article}`)]
    .filter(isOnScreen)
    .slice(0, MAX_CASCADE);
  if (!posts.length) return;

  posts.forEach((post, index) => {
    post.style.setProperty('--xp-post-in-delay', `${index * STAGGER_MS}ms`);
    post.classList.add('xp-post-in');
  });

  // The animation is one-shot: take the class off so X reusing the node later
  // (navigation, virtualization) does not replay it.
  setTimeout(
    () => {
      posts.forEach((post) => {
        post.classList.remove('xp-post-in');
        post.style.removeProperty('--xp-post-in-delay');
      });
    },
    VEIL_OUT_MS + STAGGER_MS * posts.length + 700,
  );
}

/** Reveal once the veil has been visible long enough and X has posts to show. */
function scheduleRelease() {
  const root = document.documentElement;

  const tick = () => {
    // The watchdog took the veil down meanwhile.
    if (!root.hasAttribute(BOOT_ATTR)) return;
    const elapsed = performance.now() - startedAt;
    const hasFeed = Boolean(document.querySelector(`${SEL.primaryColumn} ${SEL.article}`));
    if (!hasFeed && elapsed < CONTENT_WAIT_MS) {
      setTimeout(tick, 50);
      return;
    }
    const remaining = MIN_VISIBLE_MS - elapsed;
    if (remaining > 0) {
      setTimeout(tick, remaining);
      return;
    }

    clearTimeout(watchdog);
    root.setAttribute(BOOT_ATTR, 'leaving');
    cascadePosts();
    setTimeout(() => root.removeAttribute(BOOT_ATTR), VEIL_OUT_MS + 60);
  };

  setTimeout(tick, 0);
}

/**
 * Run `apply` (feature init / inject / first scan) under the boot veil.
 * Without a transition — reduced motion, or a script injected after the page
 * finished loading — `apply` runs synchronously, exactly as before.
 *
 * @param {() => void} apply
 */
export function runBootIntro(apply) {
  // Normally up since document-start. If boot somehow runs first, put it up
  // now (the guards live in startBootVeil).
  if (!document.documentElement?.hasAttribute(BOOT_ATTR) && !expired) startBootVeil();

  try {
    apply();
  } finally {
    if (document.documentElement?.hasAttribute(BOOT_ATTR)) scheduleRelease();
  }
}
