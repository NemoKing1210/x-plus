import { Codes, logWarn } from '../../core/debug.js';
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

/** Rewrite the stylesheet for the current settings. */
export function applyRuleStyles() {
  const cfg = getFeatureSettings('interface');
  const css = RULES.filter((rule) => isRuleOn(cfg, rule))
    .map((rule) =>
      rule.css ? `${rule.css}${HIDE}` : `[${MARK_ATTR}~="${ruleId(rule)}"]${HIDE}`,
    )
    .join('\n');
  ensureStyle().textContent = css;
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
