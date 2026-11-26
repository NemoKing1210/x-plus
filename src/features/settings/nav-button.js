import { dom, getGeneration, navUsesHoverClass } from '../../core/compat/index.js';
import { UI_ATTR } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { applyNavIcon, applyNavLabel, navRowNeedsRebuild } from './nav-dom.js';

/**
 * Adds an "X Plus" row to X's left navigation (before More / Settings) by
 * cloning one of X's own inactive rows, so typography, spacing and the hover
 * pill match the native items exactly.
 */

const NAV_ATTR = 'data-xp-nav';

/** X adds this on the pill via JS on hover (not CSS :hover). May change with client builds. */
let navHoverClass = 'r-1hdo0pc';

let openHandler = () => {};
export function setNavButtonHandler(fn) {
  openHandler = fn;
}

/** The sidebar X renders for the current breakpoint (a single `<nav>`). */
function findSideNavs() {
  const nav = dom.getNav(document);
  return nav ? [nav] : [];
}


/** Learn the live hover class from native rows (X renames r-* hashes over time). */
function observeNativeNavHoverClass(nav) {
  // The modern build styles the row with CSS: nothing to learn, nothing to mirror.
  if (!navUsesHoverClass(getGeneration())) return;
  if (nav.dataset.xpHoverObs === '1') return;
  nav.dataset.xpHoverObs = '1';
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
      const node = mutation.target;
      if (!(node instanceof Element)) continue;
      if (node.closest(`[${NAV_ATTR}]`)) continue;
      if (!nav.contains(node)) continue;
      const parent = node.parentElement;
      if (!parent || parent.parentElement !== nav) continue;
      const role = parent.getAttribute('role');
      if (role !== 'link' && role !== 'button') continue;
      const before = new Set(String(mutation.oldValue || '').split(/\s+/).filter(Boolean));
      const added = [...node.classList].filter((c) => !before.has(c) && /^r-[a-z0-9]+$/i.test(c));
      if (added.length === 1) {
        navHoverClass = added[0];
        // Learned once per navigation bar: stop observing class churn on the
        // whole sidebar for the rest of the session.
        observer.disconnect();
        break;
      }
    }
  });
  observer.observe(nav, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
  });
}

const navHoverPill = (btn) =>
  btn?.firstElementChild instanceof HTMLElement ? btn.firstElementChild : null;

/** Mirror X: toggle the hover outline class on the inner pill. */
function bindNavHoverChrome(btn) {
  if (!(btn instanceof HTMLElement) || btn.dataset.xpNavHover === '1') return;
  if (!navUsesHoverClass(getGeneration())) return;
  btn.dataset.xpNavHover = '1';

  const setHover = (on) => {
    const pill = navHoverPill(btn);
    if (!pill || !navHoverClass) return;
    pill.classList.toggle(navHoverClass, on);
  };

  btn.addEventListener('pointerenter', () => setHover(true));
  btn.addEventListener('pointerleave', () => setHover(false));
  btn.addEventListener('focusin', () => setHover(true));
  btn.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && btn.contains(event.relatedTarget)) return;
    setHover(false);
  });
}

function syncNavButtonLabels(btn) {
  const label = t('nav.label');
  if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  const node = btn.querySelector('[data-xp-nav-label]') || applyNavLabel(btn, label);
  if (node && node.textContent !== label) node.textContent = label;
  btn.dataset.xpNavOk = '1';
}

function stripNavBadges(root) {
  root
    .querySelectorAll(
      '[aria-live], [aria-label*="непрочит" i], [aria-label*="unread" i], [aria-label*="Количество" i]',
    )
    .forEach((node) => node.remove());
}

/** Deep-clone the template into an <a>, preserving every native class. */
function buildNavButton(template) {
  let btn;
  if (template instanceof HTMLAnchorElement) {
    btn = template.cloneNode(true);
  } else {
    btn = document.createElement('a');
    btn.className = template.className;
    btn.innerHTML = template.innerHTML;
  }

  // X's own markers (test ids, analytics ids, …) describe the row we cloned, not ours.
  for (const attr of [...btn.attributes]) {
    if (attr.name.startsWith('data-')) btn.removeAttribute(attr.name);
  }
  btn.href = '#';
  btn.setAttribute(NAV_ATTR, '1');
  btn.setAttribute(UI_ATTR, '');
  btn.setAttribute('role', 'link');
  for (const attr of ['type', 'aria-expanded', 'aria-haspopup', 'aria-describedby', 'aria-current']) {
    btn.removeAttribute(attr);
  }
  btn.setAttribute('aria-label', t('nav.label'));
  btn.tabIndex = 0;

  stripNavBadges(btn);
  applyNavIcon(btn);
  applyNavLabel(btn, t('nav.label'));
  bindNavHoverChrome(btn);
  btn.dataset.xpNavOk = '1';

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openHandler();
  });
  return btn;
}

/** Remove our row (feature switched off). */
export function removeNavButton() {
  document.querySelectorAll(`[${NAV_ATTR}]`).forEach((node) => node.remove());
}

/** Idempotent: insert / refresh the row in every matching navigation bar. */
export function ensureNavButton() {
  if (!getFeatureSettings('general').navButton) {
    removeNavButton();
    return;
  }
  for (const nav of findSideNavs()) {
    observeNativeNavHoverClass(nav);
    const existing = nav.querySelector(`[${NAV_ATTR}]`);

    // Fast path: our row is healthy — no template search, no style reads.
    if (existing && !navRowNeedsRebuild(existing)) {
      syncNavButtonLabels(existing);
      bindNavHoverChrome(existing);
      continue;
    }

    const slot = dom.getNavTemplate(nav);
    if (!slot) continue;

    if (existing) {
      existing.replaceWith(buildNavButton(slot.template));
      continue;
    }

    const btn = buildNavButton(slot.template);
    if (slot.before) {
      slot.before.insertAdjacentElement('beforebegin', btn);
    } else if (slot.template.parentElement === nav) {
      slot.template.insertAdjacentElement('beforebegin', btn);
    } else {
      nav.appendChild(btn);
    }
  }
}
