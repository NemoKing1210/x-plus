import { UI_ATTR } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { iconPath } from '../../ui/icons.js';

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

function findSideNavs() {
  const bars = [
    ...document.querySelectorAll('[data-testid="AppTabBar"]'),
    ...document.querySelectorAll('nav[role="navigation"]'),
  ];
  const seen = new Set();
  return bars.filter((nav) => {
    if (seen.has(nav)) return false;
    seen.add(nav);
    return Boolean(
      nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
        nav.querySelector('a[href="/settings"]') ||
        nav.querySelector('a[href*="/settings"]') ||
        nav.querySelector('a[data-testid="AppTabBar_Home_Link"]'),
    );
  });
}

function navLabelWeight(node) {
  const label = node?.querySelector?.('div[dir]');
  if (!label) return null;
  const raw = getComputedStyle(label).fontWeight;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  if (raw === 'bold') return 700;
  if (raw === 'normal') return 400;
  return null;
}

/** Learn the live hover class from native rows (X renames r-* hashes over time). */
function observeNativeNavHoverClass(nav) {
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
      if (added.length === 1) navHoverClass = added[0];
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

/**
 * Clone an *inactive* native row so we get normal weight + hover pill.
 * Prefer More (never a selected route); never prefer Home — often active/bold.
 */
function findNavTemplate(nav) {
  const more = nav.querySelector('[data-testid="AppTabBar_More_Menu"]');
  if (more?.querySelector('svg') && more.querySelector('div[dir]')) return more;

  const links = [...nav.querySelectorAll('a[role="link"], a[href]')].filter(
    (a) => !a.hasAttribute(NAV_ATTR) && a.querySelector('svg') && a.querySelector('div[dir]'),
  );

  const inactive = links.find((a) => {
    if (a.getAttribute('aria-current') === 'page') return false;
    const weight = navLabelWeight(a);
    return weight == null || weight < 600;
  });
  if (inactive) return inactive;

  return (
    nav.querySelector('a[data-testid="AppTabBar_Explore_Link"]') ||
    nav.querySelector('a[data-testid="AppTabBar_Profile_Link"]') ||
    links[0] ||
    null
  );
}

function findNavInsertBefore(nav) {
  return (
    nav.querySelector('[data-testid="AppTabBar_More_Menu"]') ||
    nav.querySelector('a[href="/settings"]') ||
    nav.querySelector('a[href*="/settings"]') ||
    null
  );
}

function syncNavButtonLabels(btn) {
  const label = t('nav.label');
  btn.setAttribute('aria-label', label);
  const node = btn.querySelector('[data-xp-nav-label]') || btn.querySelector('div[dir] > span');
  if (node) node.textContent = label;
}

function stripNavBadges(root) {
  root
    .querySelectorAll(
      '[aria-live], [aria-label*="непрочит" i], [aria-label*="unread" i], [aria-label*="Количество" i]',
    )
    .forEach((node) => node.remove());
}

function applyNavIcon(svg) {
  if (!(svg instanceof SVGElement)) return;
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  // Keep X's svg class list (size / fill via r-*); only swap the glyph.
  svg.innerHTML = `<g><path d="${iconPath('plus')}"></path></g>`;
}

function applyNavLabel(root, text) {
  const labelDiv = [...root.querySelectorAll('div[dir]')].find(
    (node) => node.querySelector(':scope > span') && !node.querySelector('svg'),
  );
  const target = labelDiv
    ? labelDiv.querySelector(':scope > span')
    : root.querySelector('span');
  if (!target) return;
  target.textContent = text;
  target.setAttribute('data-xp-nav-label', '1');
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

  btn.href = '#';
  btn.setAttribute(NAV_ATTR, '1');
  btn.setAttribute(UI_ATTR, '');
  btn.setAttribute('role', 'link');
  for (const attr of [
    'data-testid',
    'type',
    'aria-expanded',
    'aria-haspopup',
    'aria-describedby',
    'aria-current',
  ]) {
    btn.removeAttribute(attr);
  }
  btn.setAttribute('aria-label', t('nav.label'));
  btn.tabIndex = 0;

  stripNavBadges(btn);
  applyNavIcon(btn.querySelector('svg'));
  applyNavLabel(btn, t('nav.label'));
  bindNavHoverChrome(btn);

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openHandler();
  });
  return btn;
}

function navButtonNeedsRebuild(btn) {
  if (!btn.querySelector('svg') || !btn.querySelector('div[dir]')) return true;
  // Cloned from active Home → bold label; rebuild from an inactive template.
  const weight = navLabelWeight(btn);
  if (weight != null && weight >= 600) return true;
  return btn.dataset.xpNavHover !== '1';
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
    const template = findNavTemplate(nav);
    if (!template) continue;

    if (existing) {
      if (navButtonNeedsRebuild(existing)) {
        existing.replaceWith(buildNavButton(template));
      } else {
        syncNavButtonLabels(existing);
        bindNavHoverChrome(existing);
      }
      continue;
    }

    const insertBefore = findNavInsertBefore(nav);
    const btn = buildNavButton(template);
    if (insertBefore) {
      insertBefore.insertAdjacentElement('beforebegin', btn);
    } else if (template.parentElement === nav) {
      template.insertAdjacentElement('beforebegin', btn);
    } else {
      nav.appendChild(btn);
    }
  }
}
