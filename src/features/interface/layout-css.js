import { cssFor } from '../../core/compat/index.js';

/**
 * Layout CSS (content width, centred feed, pinned columns, static feed tabs).
 *
 * Kept apart from `engine.js` so the generated selectors can be unit-tested
 * without the settings/storage modules. Every selector here is built from
 * compat fragments; none may nest `:has()` inside another `:has()` (the
 * browser drops that branch and the modern build silently loses the rule).
 */

/** Set on a hidden element to reveal it while the settings preview runs. */
export const PEEK_ATTR = 'data-xp-peek';
/** Remembers a wrapper that was already un-stuck from the feed tabs. */
export const STICKY_ATTR = 'data-xp-sticky';

/** Widen the central column (and the wrappers that cap it) to `width` px. */
export function contentWidthCss(width) {
  if (!width) return '';
  const column = cssFor('primaryColumn');
  // X caps inner feed blocks with an atomic class; only the legacy profile knows it.
  const cap = cssFor('contentCap');
  // The wrapper fragments are legacy-only: the modern column is the `main`
  // element itself, centred by the row, so growing the box around it would
  // absorb the free space and pull the feed out of place. Composing
  // `div:has(> ${column})` here would only nest the `:has()` of the modern
  // column fragment, which CSS drops.
  const wrapper = cssFor('primaryColumnWrapper');
  const wrapperDeep = cssFor('primaryColumnWrapperDeep');
  return [
    `${column}{width:${width}px!important;max-width:100vw!important;flex:none!important}`,
    cap ? `${column} ${cap}{max-width:none!important}` : '',
    wrapper ? `${wrapper}{width:auto!important;max-width:none!important;flex-grow:1}` : '',
    wrapperDeep ? `${wrapperDeep}{width:auto!important;max-width:none!important;flex-grow:1}` : '',
  ].filter(Boolean).join('\n');
}

/** Column / chrome selectors as `:is(legacy, modern)` unions. */
const LEFT_NAV = cssFor('leftNav');
const SIDEBAR = cssFor('sidebarColumn');

/** Pin the left navigation to the screen edge instead of next to the feed. */
export const MENU_LEFT_CSS = [
  `${LEFT_NAV}{align-items:flex-start!important}`,
  `${LEFT_NAV} > div{align-items:flex-start!important}`,
].join('\n');

/**
 * Centre the menu items (logo, links, post button) vertically: every wrapper
 * on the way down to the nav grows to the full height and the one that holds
 * the nav centres its children.
 */
const NAV_LIST = cssFor('leftNavList');
/** The modern nav is itself the column: its rows are the flex children to centre. */
const NAV_CENTER = cssFor('navCenter');
export const MENU_CENTER_CSS = [
  NAV_LIST ? `${LEFT_NAV} div:has(${NAV_LIST}){flex:1 1 auto!important;min-height:0}` : '',
  NAV_LIST ? `${LEFT_NAV} div:has(> ${NAV_LIST}){display:flex!important;flex-direction:column!important;justify-content:center!important}` : '',
  NAV_CENTER ? `${NAV_CENTER}{justify-content:center!important}` : '',
].filter(Boolean).join('\n');

/** Remove the whole left menu from the page. */
export const MENU_HIDE_CSS = `${LEFT_NAV}:not([${PEEK_ATTR}]){display:none!important}`;

/** Remove the whole right column from the page. */
export const SIDEBAR_HIDE_CSS = `${SIDEBAR}:not([${PEEK_ATTR}]){display:none!important}`;

/**
 * Let the feed tabs scroll away with the page instead of floating at the top.
 *
 * `relative`, not `static`: on the modern build the sticky element is X's page
 * `<header>`, and its frosted backdrop is an absolutely positioned child sized
 * with `height: calc(100% + …)`. A `static` header is no longer that child's
 * containing block, so the backdrop resolves against the viewport, grows to the
 * full screen and shades the whole timeline until the next scroll. `relative`
 * leaves the flow exactly like `static` and keeps the header positioned for its
 * children.
 */
export const FEED_TABS_STATIC_CSS = `[${STICKY_ATTR}]{position:relative!important}`;

/** Pin the right column (search, trends, who to follow) to the screen edge. */
export const SIDEBAR_RIGHT_CSS = `${SIDEBAR}{position:fixed!important;top:0;right:0;bottom:0;width:350px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}`;

/**
 * Centre the feed on the screen: both side columns leave the layout (menu
 * pinned left, right column pinned right) and the feed wrapper centres itself.
 * The wrapper fills its parent row with `100%`, not `100vw`: viewport units
 * include the vertical scrollbar, which would add a horizontal scrollbar.
 */
const CENTER_ROW = cssFor('mainRow');
const CENTER_WRAPPER = cssFor('primaryColumnWrapper');
export const CENTER_CSS = [
  `${LEFT_NAV}{position:fixed!important;top:0;bottom:0;left:0;z-index:2;width:auto!important;flex-grow:0!important}`,
  SIDEBAR_RIGHT_CSS,
  CENTER_ROW ? `${CENTER_ROW}{flex:none!important;display:flex!important;flex-direction:row!important;justify-content:center!important;align-items:flex-start!important;width:100%!important;max-width:none!important}` : '',
  CENTER_ROW ? `${CENTER_ROW} > div,${CENTER_ROW} > div > div{flex:0 1 auto!important;width:auto!important;max-width:none!important;margin:0!important}` : '',
  CENTER_WRAPPER ? `${CENTER_WRAPPER}{width:auto!important;max-width:none!important;flex-grow:0!important}` : '',
].filter(Boolean).join('\n');
