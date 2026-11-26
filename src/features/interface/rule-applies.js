/**
 * Whether a clean-up rule applies to the DOM generation the page is running.
 *
 * A rule whose target no longer exists on a generation is kept in the table
 * (stored settings keep working) but skipped there, and its control is hidden:
 * a switch that silently does nothing is worse than no switch.
 *
 * @param {{ generations?: Record<string, boolean> }} rule
 * @param {string} generation - 'legacy' | 'modern' | 'unknown'
 * @returns {boolean}
 */
export function ruleApplies(rule, generation) {
  return rule?.generations?.[generation] !== false;
}

/**
 * Whether any rule of `group` applies to `generation`: a settings section whose
 * every switch would do nothing is hidden as a whole.
 *
 * @param {{ group: string, generations?: Record<string, boolean> }[]} rules
 * @param {string} group
 * @param {string} generation
 * @returns {boolean}
 */
export function groupApplies(rules, group, generation) {
  return rules.some((rule) => rule.group === group && ruleApplies(rule, generation));
}
