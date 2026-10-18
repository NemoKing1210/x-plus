import { Codes, logWarn } from '../../core/debug.js';
import { SEL, UI_ATTR } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { POSTS_PEEK_ATTR, postsCss } from './posts.js';
import { RULES, findStickyFeedHeaders, ruleId } from './rules.js';

/**
 * Applies the enabled rules: one generated stylesheet hides everything. Rules
 * that can be written in CSS (`css`) need nothing else. Rules that need JS to
 * locate their targets mark the matches with `data-xp-hide~="<rule id>"`:
 *
 *  - per-post rules (`inArticle`) run only for posts that were added or changed,
 *    synchronously inside the MutationObserver callback, i.e. before the browser
 *    paints, so nothing flashes and nothing rescans the whole page;
 *  - page-level rules (`find`: menu, sidebar, composer, …) run in a throttled pass
 *    that cannot be starved by a steady stream of mutations.
 *
 * Toggling a rule only rewrites the stylesheet and re-checks the posts on screen.
 */

const STYLE_ID = 'xp-interface-style';
const MARK_ATTR = 'data-xp-hide';
const HIDE = '{display:none!important}';
const STICKY_ATTR = 'data-xp-sticky';
const PEEK_ATTR = 'data-xp-peek';
const PEEK_STYLE_ID = 'xp-interface-peek-style';
/** Most time one observer callback may spend on posts before it yields to the next frame. */
const BUDGET_MS = 8;
/** Minimum gap between two page-level passes. */
const PAGE_INTERVAL_MS = 120;

const isRuleOn = (cfg, rule) =>
  rule.view ? cfg.postView?.[rule.view] === true : cfg.enabled && cfg[rule.group]?.[rule.key] === true;

function ensureStyle() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  return style;
}

/** Widen the central column (and the wrappers that cap it) to `width` px. */
function contentWidthCss(width) {
  if (!width) return '';
  const column = SEL.primaryColumn;
  return [
    `${column}{width:${width}px!important;max-width:100vw!important;flex:none!important}`,
    // X caps inner feed blocks with the atomic class `max-width: 600px`.
    `${column} .r-1ye8kvj{max-width:none!important}`,
    `div:has(> ${column}),div:has(> div > ${column}){width:auto!important;max-width:none!important;flex-grow:1}`,
  ].join('\n');
}

/** Pin the left navigation to the screen edge instead of next to the feed. */
const MENU_LEFT_CSS = [
  'header[role="banner"]{align-items:flex-start!important}',
  'header[role="banner"] > div{align-items:flex-start!important}',
].join('\n');

/**
 * Centre the menu items (logo, links, post button) vertically: every wrapper
 * on the way down to the nav grows to the full height and the one that holds
 * the nav centres its children.
 */
const MENU_CENTER_CSS = [
  'header[role="banner"] div:has(nav[role="navigation"]){flex:1 1 auto!important;min-height:0}',
  'header[role="banner"] div:has(> nav[role="navigation"]){display:flex!important;flex-direction:column!important;justify-content:center!important}',
].join('\n');

/** Remove the whole left menu from the page. */
const MENU_HIDE_CSS = `header[role="banner"]:not([${PEEK_ATTR}]){display:none!important}`;

/** Remove the whole right column from the page. */
const SIDEBAR_HIDE_CSS = `${SEL.sidebar}:not([${PEEK_ATTR}]){display:none!important}`;

/** Let the feed tabs scroll away with the page instead of floating at the top. */
const FEED_TABS_STATIC_CSS = `[${STICKY_ATTR}]{position:static!important}`;

/** Pin the right column (search, trends, who to follow) to the screen edge. */
const SIDEBAR_RIGHT_CSS = `${SEL.sidebar}{position:fixed!important;top:0;right:0;bottom:0;width:350px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}`;

/**
 * Centre the feed on the screen: both side columns leave the layout (menu
 * pinned left, right column pinned right) and the feed wrapper centres itself.
 */
const CENTER_CSS = [
  'header[role="banner"]{position:fixed!important;top:0;bottom:0;left:0;z-index:2;width:auto!important;flex-grow:0!important}',
  SIDEBAR_RIGHT_CSS,
  'main[role="main"]{flex:none!important;display:flex!important;flex-direction:row!important;justify-content:center!important;align-items:flex-start!important;width:100vw!important;max-width:none!important}',
  'main[role="main"] > div,main[role="main"] > div > div{flex:0 1 auto!important;width:auto!important;max-width:none!important;margin:0!important}',
  `div:has(> ${SEL.primaryColumn}){width:auto!important;max-width:none!important;flex-grow:0!important}`,
].join('\n');

/** Selectors that hide a rule: its own CSS, or the marker its JS finder sets. */
const selectorsOf = (rule) => (rule.css ? [].concat(rule.css) : [`[${MARK_ATTR}~="${ruleId(rule)}"]`]);

/** Rewrite the stylesheet for the current settings. */
export function applyRuleStyles() {
  const cfg = getFeatureSettings('interface');
  // `:not([data-xp-peek])` lets the settings preview reveal a hidden element.
  const rules = RULES.filter((rule) => isRuleOn(cfg, rule))
    .flatMap(selectorsOf)
    .map((selector) => `${selector}:not([${PEEK_ATTR}])${HIDE}`)
    .join('\n');
  ensureStyle().textContent = [rules, contentWidthCss(cfg.contentWidth), cfg.menuLeft ? MENU_LEFT_CSS : '',
    cfg.menuCenter ? MENU_CENTER_CSS : '',
    cfg.enabled && cfg.feedTabsStatic ? FEED_TABS_STATIC_CSS : '',
    cfg.enabled && cfg.sidebarHide ? SIDEBAR_HIDE_CSS : '',
    cfg.enabled && cfg.menuHide ? MENU_HIDE_CSS : '',
    cfg.sidebarRight || cfg.centerContent ? SIDEBAR_RIGHT_CSS : '',
    cfg.centerContent ? CENTER_CSS : '',
    postsCss(cfg.postView)].filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------ */
/* Settings preview ("peek")                                           */
/* ------------------------------------------------------------------ */

const PEEK_HIGHLIGHT_CSS = `[${PEEK_ATTR}]{outline:2px solid var(--xp-accent,#1d9bf0)!important;outline-offset:3px;border-radius:6px;box-shadow:0 0 0 6px rgba(29,155,240,.25),0 0 24px 6px rgba(29,155,240,.35)!important;animation:xp-peek-pulse 1.1s ease-in-out infinite alternate}
@keyframes xp-peek-pulse{from{outline-color:rgba(29,155,240,.5)}to{outline-color:var(--xp-accent,#1d9bf0)}}
@media (prefers-reduced-motion:reduce){[${PEEK_ATTR}]{animation:none!important}}`;

/** Layout option → CSS it adds when switched on (`value` is the draft value). */
const LAYOUT_PEEK = {
  contentWidth: (value) => contentWidthCss(value),
  menuLeft: () => MENU_LEFT_CSS,
  menuCenter: () => MENU_CENTER_CSS,
  feedTabsStatic: () => FEED_TABS_STATIC_CSS,
  sidebarHide: () => SIDEBAR_HIDE_CSS,
  menuHide: () => MENU_HIDE_CSS,
  sidebarRight: () => SIDEBAR_RIGHT_CSS,
  centerContent: () => [SIDEBAR_RIGHT_CSS, CENTER_CSS].join('\n'),
};

function peekStyle() {
  let style = document.getElementById(PEEK_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PEEK_STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  return style;
}

const isOnScreen = (node) => {
  const rect = node.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
};

/**
 * `node` itself, or its first descendant that has a size: X's left menu
 * `<header>` is a zero-size box whose fixed-position children are drawn.
 */
function visibleBox(node) {
  const queue = [node];
  while (queue.length) {
    const current = queue.shift();
    const rect = current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return current;
    queue.push(...current.children);
  }
  return node;
}

/** Every element `rule` would hide right now (works whether or not the rule is on). */
function ruleTargets(rule) {
  if (rule.css) return [...document.querySelectorAll([].concat(rule.css).join(','))];
  if (rule.inArticle) {
    return [...document.querySelectorAll(SEL.article)].flatMap((article) => rule.inArticle(article, new Map()));
  }
  return rule.find(document);
}

/** Stop any running preview and restore the page. */
export function endPeek() {
  document.querySelectorAll(`[${PEEK_ATTR}]`).forEach((node) => node.removeAttribute(PEEK_ATTR));
  document.getElementById(PEEK_STYLE_ID)?.remove();
  document.documentElement.removeAttribute(POSTS_PEEK_ATTR);
}

/**
 * Preview the draft post appearance on the page.
 * @returns {number} how many posts are visible on screen
 */
export function peekPosts(postView) {
  endPeek();
  document.documentElement.setAttribute(POSTS_PEEK_ATTR, '');
  peekStyle().textContent = postsCss(postView, true);
  return [...document.querySelectorAll(`${SEL.primaryColumn} ${SEL.article}`)].filter(isOnScreen).length;
}

/**
 * Highlight what a rule hides: elements it targets are un-hidden (if they
 * were) and outlined. Works whether or not the rule is currently enabled.
 * @returns {number} how many of the targets are visible on screen
 */
export function peekRule(ruleKey) {
  endPeek();
  const rule = RULES.find((candidate) => ruleId(candidate) === ruleKey);
  if (!rule) return 0;
  let targets = [];
  try {
    targets = ruleTargets(rule);
  } catch (error) {
    logWarn(Codes.DECLUTTER_RULE, `peek "${ruleKey}" failed`, { error });
  }
  peekStyle().textContent = PEEK_HIGHLIGHT_CSS;
  targets.forEach((node) => node.setAttribute(PEEK_ATTR, ''));
  return targets.filter(isOnScreen).length;
}

/** Layout option → the page elements it moves or resizes (outlined while previewing). */
const LAYOUT_TARGETS = {
  contentWidth: () => document.querySelectorAll(SEL.primaryColumn),
  centerContent: () => document.querySelectorAll(SEL.primaryColumn),
  menuLeft: () => document.querySelectorAll('header[role="banner"]'),
  menuCenter: () => document.querySelectorAll('header[role="banner"]'),
  menuHide: () => document.querySelectorAll('header[role="banner"]'),
  sidebarRight: () => document.querySelectorAll(SEL.sidebar),
  sidebarHide: () => document.querySelectorAll(SEL.sidebar),
  feedTabsStatic: () => document.querySelectorAll(`[${STICKY_ATTR}]`),
};

/**
 * Temporarily apply one layout option (with its draft `value`) to the page
 * and outline the elements it affects.
 * @returns {number} how many of those elements are visible on screen
 */
export function peekLayout(key, value) {
  endPeek();
  if (key === 'feedTabsStatic') markSticky();
  const css = LAYOUT_PEEK[key]?.(value) ?? '';
  const targets = [...(LAYOUT_TARGETS[key]?.() ?? [])];
  // Un-hide the target itself, but outline the box that is actually drawn.
  const boxes = targets.map((node) => {
    node.setAttribute(PEEK_ATTR, '');
    const box = visibleBox(node);
    box.setAttribute(PEEK_ATTR, '');
    return box;
  });
  if (css || targets.length) peekStyle().textContent = `${css}
${PEEK_HIGHLIGHT_CSS}`;
  return boxes.filter(isOnScreen).length;
}

/* ------------------------------------------------------------------ */
/* Marking                                                             */
/* ------------------------------------------------------------------ */

const OWNER = `${SEL.article}, [${UI_ATTR}]`;

let articleRules = [];
let pageRules = [];
let stickyNeeded = false;
let observer = null;
/** Posts that appeared or changed and still wait for their rules. */
const dirty = new Set();
let frame = 0;
let pageQueued = false;
let lastPage = 0;
/** article → what we marked for it (node → rule ids), so stale marks can be taken back. */
const applied = new WeakMap();

function addToken(node, id) {
  const current = node.getAttribute(MARK_ATTR) || '';
  if (current.split(' ').includes(id)) return;
  node.setAttribute(MARK_ATTR, `${current} ${id}`.trim());
}

function removeToken(node, id) {
  const tokens = (node.getAttribute(MARK_ATTR) || '').split(' ').filter((token) => token && token !== id);
  if (tokens.length) node.setAttribute(MARK_ATTR, tokens.join(' '));
  else node.removeAttribute(MARK_ATTR);
}

/** Recompute the marks of one post; X reuses DOM nodes, so marks that no longer apply are removed. */
function processArticle(article) {
  if (!article.isConnected) return;
  const memo = new Map();
  const fresh = new Map();
  for (const rule of articleRules) {
    const id = ruleId(rule);
    try {
      for (const node of rule.inArticle(article, memo)) {
        const ids = fresh.get(node);
        if (ids) ids.add(id);
        else fresh.set(node, new Set([id]));
      }
    } catch (error) {
      logWarn(Codes.DECLUTTER_RULE, `rule "${id}" failed`, { error });
    }
  }
  const previous = applied.get(article);
  if (previous) {
    for (const [node, ids] of previous) {
      const keep = fresh.get(node);
      for (const id of ids) if (!keep?.has(id)) removeToken(node, id);
    }
  }
  for (const [node, ids] of fresh) for (const id of ids) addToken(node, id);
  if (fresh.size) applied.set(article, fresh);
  else applied.delete(article);
}

/** Process queued posts; whatever does not fit the time budget moves to the next frame. */
function flush() {
  frame = 0;
  const started = performance.now();
  for (const article of dirty) {
    dirty.delete(article);
    processArticle(article);
    if (performance.now() - started > BUDGET_MS) break;
  }
  if (dirty.size) frame = requestAnimationFrame(flush);
}

/** Remember which wrappers float (they stop being `sticky` once un-stuck by us). */
function markSticky() {
  try {
    for (const node of findStickyFeedHeaders(document)) node.setAttribute(STICKY_ATTR, '');
  } catch (error) {
    logWarn(Codes.DECLUTTER_RULE, 'sticky feed header lookup failed', { error });
  }
}

/** Page-level rules (menu, sidebar, composer, …) and the sticky feed header. */
function runPage() {
  lastPage = performance.now();
  if (stickyNeeded) markSticky();
  for (const rule of pageRules) {
    try {
      for (const node of rule.find(document)) addToken(node, ruleId(rule));
    } catch (error) {
      logWarn(Codes.DECLUTTER_RULE, `rule "${ruleId(rule)}" failed`, { error });
    }
  }
}

/** Throttled, not debounced: a page that never stops mutating still gets its pass. */
function schedulePage() {
  if (pageQueued || (!pageRules.length && !stickyNeeded)) return;
  pageQueued = true;
  const run = () => {
    pageQueued = false;
    runPage();
  };
  const wait = PAGE_INTERVAL_MS - (performance.now() - lastPage);
  if (wait > 0) setTimeout(run, wait);
  else requestAnimationFrame(run);
}

function onMutations(records) {
  let page = false;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      const owner = node.closest(OWNER);
      if (owner) {
        // Inside a post: re-check that post. Inside our own UI: ignore.
        if (!owner.hasAttribute(UI_ATTR) && articleRules.length) dirty.add(owner);
        continue;
      }
      page = true;
      if (articleRules.length) for (const article of node.querySelectorAll(SEL.article)) dirty.add(article);
    }
  }
  // Same task as the mutation, before the browser paints: nothing flashes.
  if (dirty.size && !frame) flush();
  if (page) schedulePage();
}

function setObserving(on) {
  if (on && !observer) {
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } else if (!on && observer) {
    observer.disconnect();
    observer = null;
    dirty.clear();
  }
}

/**
 * Settings changed (or first start): recompute which rules are on, start / stop watching the
 * page and check everything that is on screen once.
 */
export function syncRules() {
  const cfg = getFeatureSettings('interface');
  const enabled = RULES.filter((rule) => isRuleOn(cfg, rule));
  articleRules = enabled.filter((rule) => rule.inArticle);
  pageRules = enabled.filter((rule) => rule.find);
  stickyNeeded = Boolean(cfg.enabled && cfg.feedTabsStatic);
  setObserving(articleRules.length > 0 || pageRules.length > 0 || stickyNeeded);
  if (articleRules.length) {
    for (const article of document.querySelectorAll(SEL.article)) dirty.add(article);
    if (!frame) flush();
  }
  runPage();
}

/** The URL changed: page-level targets (tabs, "Discover more", …) may have appeared or gone. */
export function refreshPage() {
  schedulePage();
}
