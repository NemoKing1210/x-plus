import { SEL } from '../../core/constants.js';
import { icon } from '../../ui/icons.js';
import { el, silencePointerEvents } from '../../utils/dom.js';
import { ATTR, cfg, tm } from './config.js';
import { startDownload } from './flow.js';
import { getActionGroup, getMediaHosts, photoIndex } from './tweet.js';

/**
 * Download buttons.
 *
 *  - action bar: one button next to Share that downloads every media item of
 *    the post (asks when there are several);
 *  - overlay: a small button over each video / photo that downloads exactly
 *    that element.
 */

function bindButton(button, onActivate) {
  silencePointerEvents(button);
  button.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.classList.contains('is-loading')) return;
      onActivate();
    },
    true,
  );
}

function setBusy(button) {
  return (busy) => {
    button.classList.toggle('is-loading', busy);
    button.toggleAttribute('aria-busy', busy);
  };
}

/* ------------------------------------------------------------------ */
/* Action bar button                                                   */
/* ------------------------------------------------------------------ */

function createActionButton(article) {
  const wrap = el('div', 'xp-action');
  wrap.setAttribute(ATTR.action, '1');
  const button = el('button', 'xp-action__btn');
  button.type = 'button';
  button.innerHTML = icon('download') + '<span class="xp-action__spinner" aria-hidden="true"></span>';
  button.setAttribute('aria-label', tm('download'));
  button.title = tm('download');
  wrap.appendChild(button);

  bindButton(button, () =>
    startDownload({ article, anchor: button, setBusy: setBusy(button) }),
  );
  return wrap;
}

function ensureActionButton(article) {
  const group = getActionGroup(article);
  if (!group) return;
  let wrap = article.querySelector(`[${ATTR.action}]`);
  if (!wrap) wrap = createActionButton(article);
  if (wrap.parentElement !== group || group.lastElementChild !== wrap) group.appendChild(wrap);
  const label = tm('download');
  const button = wrap.firstElementChild;
  if (button.getAttribute('aria-label') !== label) {
    button.setAttribute('aria-label', label);
    button.title = label;
  }
}

/* ------------------------------------------------------------------ */
/* Overlay buttons                                                     */
/* ------------------------------------------------------------------ */

function createOverlay(article, host) {
  const button = el('button', 'xp-media-btn');
  button.type = 'button';
  button.setAttribute(ATTR.overlay, '1');
  button.innerHTML = icon('download') + '<span class="xp-action__spinner" aria-hidden="true"></span>';
  button.setAttribute('aria-label', tm('download'));
  button.title = tm('download');

  bindButton(button, () => {
    const filter =
      host.kind === 'photo'
        ? (item) =>
            item.type === 'photo' &&
            item.owner === host.owner &&
            item.index === photoIndex(article, host)
        : (item) => item.type !== 'photo' && item.owner === host.owner;
    startDownload({ article, anchor: button, filter, setBusy: setBusy(button) });
  });
  return button;
}

function ensureOverlay(article, host) {
  if (host.el.querySelector(`:scope > [${ATTR.overlay}]`)) return;
  if (getComputedStyle(host.el).position === 'static') host.el.classList.add('xp-media-host');
  host.el.appendChild(createOverlay(article, host));
}

/* ------------------------------------------------------------------ */
/* Per-article pass                                                    */
/* ------------------------------------------------------------------ */

function removeButtons(article) {
  article.querySelectorAll(`[${ATTR.action}], [${ATTR.overlay}]`).forEach((node) => node.remove());
  article.removeAttribute(ATTR.article);
}

function enhanceArticle(article, config) {
  const hosts = getMediaHosts(article).filter((host) =>
    host.kind === 'photo' ? config.images : config.videos || config.gifs,
  );
  if (!hosts.length) {
    if (article.hasAttribute(ATTR.article)) removeButtons(article);
    return;
  }
  article.setAttribute(ATTR.article, '1');

  if (config.showInActions) ensureActionButton(article);
  else article.querySelectorAll(`[${ATTR.action}]`).forEach((node) => node.remove());

  if (config.showOnMedia) hosts.forEach((host) => ensureOverlay(article, host));
  else article.querySelectorAll(`[${ATTR.overlay}]`).forEach((node) => node.remove());
}

/** Idempotent pass over every post currently on the page. */
export function scanDownloadButtons() {
  const config = cfg();
  if (!config.enabled) {
    removeAllButtons();
    return;
  }
  document.querySelectorAll(SEL.article).forEach((article) => enhanceArticle(article, config));
}

export function removeAllButtons() {
  document.querySelectorAll(SEL.article).forEach((article) => {
    if (article.hasAttribute(ATTR.article)) removeButtons(article);
  });
}
