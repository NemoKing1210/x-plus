import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { applyRuleStyles, markRuleTargets } from './engine.js';
import { RULES, RULE_GROUPS, ruleLabelKey } from './rules.js';

/** One boolean field per rule, grouped (`posts.promoted`, …). */
function ruleFields() {
  const groups = {};
  for (const group of RULE_GROUPS) groups[group] = {};
  for (const rule of RULES) groups[rule.group][rule.key] = field.bool(Boolean(rule.on));
  return Object.fromEntries(
    Object.entries(groups).map(([group, fields]) => [group, field.record(fields)]),
  );
}

const countEnabled = (draft) => {
  const cfg = draft.interface;
  if (!cfg.enabled) return t('common.off');
  const n = RULES.filter((rule) => cfg[rule.group][rule.key]).length;
  return String(n);
};

function groupSection(group) {
  return {
    titleKey: `interface.group.${group}`,
    showIf: (section) => section.enabled,
    controls: RULES.filter((rule) => rule.group === group).map((rule) => ({
      type: 'switch',
      path: `${rule.group}.${rule.key}`,
      labelKey: ruleLabelKey(rule),
      hintKey: rule.hint ? `${ruleLabelKey(rule)}Hint` : undefined,
    })),
  };
}

/**
 * Interface clean-up: hide promoted posts, suggestion blocks, menu entries
 * and other noise. Rules live in rules.js; this file only wires them to
 * settings and the page lifecycle.
 */
registerFeature({
  id: 'interface',
  order: 30,

  fields: {
    enabled: field.bool(true),
    ...ruleFields(),
  },

  tabs: [
    {
      id: 'interface',
      titleKey: 'interface.title',
      badge: countEnabled,
      sections: [
        {
          titleKey: 'interface.sectionMain',
          descKey: 'interface.sectionMainDesc',
          controls: [
            {
              type: 'switch',
              path: 'enabled',
              labelKey: 'interface.enabled',
              hintKey: 'interface.enabledHint',
            },
          ],
        },
        ...RULE_GROUPS.map(groupSection),
      ],
    },
  ],

  apply() {
    applyRuleStyles();
    markRuleTargets();
  },

  scan(root) {
    markRuleTargets(root);
  },
});
