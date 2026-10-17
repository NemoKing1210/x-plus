/**
 * Page scroll lock shared by modal overlays. Locks are counted so nested
 * overlays release in order; the scroll position is restored on unlock.
 */

const LOCK_CLASS = 'xp-scroll-lock';

let depth = 0;
let savedY = 0;

export function lockPageScroll() {
  depth += 1;
  if (depth > 1) return;
  const html = document.documentElement;
  const body = document.body;
  if (!body) return;
  savedY = window.scrollY || html.scrollTop || 0;
  html.classList.add(LOCK_CLASS);
  body.classList.add(LOCK_CLASS);
  body.style.top = `-${savedY}px`;
}

export function unlockPageScroll() {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  const html = document.documentElement;
  const body = document.body;
  if (!body || !html.classList.contains(LOCK_CLASS)) return;
  html.classList.remove(LOCK_CLASS);
  body.classList.remove(LOCK_CLASS);
  body.style.top = '';
  window.scrollTo(0, savedY);
}
