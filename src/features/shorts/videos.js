import { SHORTS_CELL_ATTR } from '../../core/constants.js';

/**
 * Videos play only in the active post. X starts every video that is on screen,
 * and in shorts mode the neighbouring posts are on screen too (blurred), so
 * their sound and motion would run behind the current one. Whatever plays in a
 * post that is not active is paused; a video we paused plays again when its
 * post becomes active (X does not restart a video that never left the screen).
 */

const NOT_ACTIVE_VIDEOS = `[${SHORTS_CELL_ATTR}]:not([${SHORTS_CELL_ATTR}="active"]) video`;
const ACTIVE_VIDEOS = `[${SHORTS_CELL_ATTR}="active"] video`;

/** Videos paused by us (not by the user or X), so only those are resumed. */
const pausedByUs = new WeakSet();

function holdBack(video) {
  if (video.paused || video.ended) return;
  pausedByUs.add(video);
  video.pause();
}

/** X (or the browser) started a video: stop it at once when its post is not the active one. */
function onPlay(event) {
  const video = event.target;
  if (!(video instanceof HTMLVideoElement)) return;
  const state = video.closest(`[${SHORTS_CELL_ATTR}]`)?.getAttribute(SHORTS_CELL_ATTR);
  if (state && state !== 'active') holdBack(video);
}

/** Pause the videos of posts that are not active, resume the ones we paused in the active post. Idempotent. */
export function syncVideos() {
  for (const video of document.querySelectorAll(NOT_ACTIVE_VIDEOS)) holdBack(video);
  for (const video of document.querySelectorAll(ACTIVE_VIDEOS)) {
    if (!pausedByUs.has(video)) continue;
    pausedByUs.delete(video);
    if (video.paused && !video.ended) video.play().catch(() => {});
  }
}

export function startVideos() {
  window.addEventListener('play', onPlay, true);
}

export function stopVideos() {
  window.removeEventListener('play', onPlay, true);
}
