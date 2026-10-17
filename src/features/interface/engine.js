import { Codes, logWarn } from '../../core/debug.js';
import { SEL } from '../../core/constants.js';
import { getFeatureSettings } from '../../core/settings.js';
import { RULES, ruleId } from './rules.js';

/**
 * Applies the enabled rules: one generated stylesheet hides everything, and
 * rules that need JS to locate their targets mark the matches with
 * `data-xp-hide~="<rule id>"`. Toggling a rule only rewrites the stylesheet.
 */

const STYLE_ID = 'xp-interface-style';
const MARK_ATTR = 'data-xp-hide';
const HIDE = '{display:none!important}';

const isRuleOn = (cfg, rule) => cfg.enabled && cfg[rule.group]?.[rule.key] === true;

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

/** Rewrite the stylesheet for the current settings. */
export function applyRuleStyles() {
  const cfg = getFeatureSettings('interface');
  const rules = RULES.filter((rule) => isRuleOn(cfg, rule))
    .map((rule) =>
      rule.css ? `${rule.css}${HIDE}` : `[${MARK_ATTR}~="${ruleId(rule)}"]${HIDE}`,
    )
    .join('\n');
  ensureStyle().textContent = [rules, contentWidthCss(cfg.contentWidth), cfg.menuLeft ? MENU_LEFT_CSS : '',
    cfg.sidebarRight || cfg.centerContent ? SIDEBAR_RIGHT_CSS : '',
    cfg.centerContent ? CENTER_CSS : ''].filter(Boolean).join('\n');
}

function mark(node, id) {
  const current = node.getAttribute(MARK_ATTR) || '';
  if (current.split(' ').includes(id)) return;
  node.setAttribute(MARK_ATTR, `${current} ${id}`.trim());
}

/** Mark the targets of every enabled JS rule under `root`. */
export function markRuleTargets(root = document) {
  const cfg = getFeatureSettings('interface');
  for (const rule of RULES) {
    if (!rule.find || !isRuleOn(cfg, rule)) continue;
    try {
      for (const node of rule.find(root)) mark(node, ruleId(rule));
    } catch (error) {
      logWarn(Codes.DECLUTTER_RULE, `rule "${ruleId(rule)}" failed`, { error });
    }
  }
}
