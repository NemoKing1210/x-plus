import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { applyRuleStyles, endPeek, markRuleTargets, peekLayout, peekRule } from './engine.js';
import { RULES, RULE_GROUPS, ruleId, ruleLabelKey } from './rules.js';

/** One boolean field per rule, grouped (`posts.promoted`, …). */
function ruleFields() {
  const groups = {};
  for (const group of RULE_GROUPS) groups[group] = {};
  for (const rule of RULES) groups[rule.group][rule.key] = field.bool(Boolean(rule.on));
  return Object.fromEntries(
    Object.entries(groups).map(([group, fields]) => [group, field.record(fields)]),
  );
}

const WIDTH_PRESETS = [
  { value: 0, labelKey: 'interface.width.default' },
  { value: 500, labelKey: 'interface.width.narrow' },
  { value: 750, labelKey: 'interface.width.wide' },
  { value: 1000, labelKey: 'interface.width.wider' },
  { value: 1400, labelKey: 'interface.width.full' },
];

const countEnabled = (draft) => {
  const cfg = draft.interface;
  if (!cfg.enabled) return t('common.off');
  const n = RULES.filter((rule) => cfg[rule.group][rule.key]).length;
  return String(n);
};

/** Hovering a clean-up switch outlines (and un-hides) what the rule affects. */
const rulePeek = (rule) => ({
  enter: () => peekRule(ruleId(rule)),
  leave: endPeek,
});

/** Hovering a layout control shows the layout it produces. */
const layoutPeek = (key) => ({
  enter: (section, value) => peekLayout(key, key === 'contentWidth' ? value : true),
  leave: endPeek,
});

const whenEnabled = (section) => section.enabled;

/** "Hide" subheading plus one switch per rule of `group` (needs the master switch). */
function hideControls(group) {
  return [
    { type: 'subheading', textKey: 'interface.sub.hide', showIf: whenEnabled },
    ...RULES.filter((rule) => rule.group === group).map((rule) => ({
      type: 'switch',
      path: `${rule.group}.${rule.key}`,
      labelKey: ruleLabelKey(rule),
      hintKey: rule.hint ? `${ruleLabelKey(rule)}Hint` : undefined,
      peek: rulePeek(rule),
      showIf: whenEnabled,
    })),
  ];
}

const layoutSwitch = (path) => ({
  type: 'switch',
  path,
  labelKey: `interface.${path}`,
  hintKey: `interface.${path}Hint`,
  peek: layoutPeek(path),
});

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
    menuLeft: field.bool(false),
    menuCenter: field.bool(false),
    feedTabsStatic: field.bool(false),
    sidebarRight: field.bool(false),
    centerContent: field.bool(false),
    contentWidth: field.int(0, { min: 0, max: 1600 }),
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
            { type: 'hint', textKey: 'interface.peekHint' },
          ],
        },
        {
          titleKey: 'interface.sectionFeed',
          descKey: 'interface.sectionFeedDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.layout' },
            {
              type: 'slider',
              path: 'contentWidth',
              labelKey: 'interface.contentWidth',
              hintKey: 'interface.contentWidthHint',
              zeroKey: 'interface.width.default',
              min: 0,
              max: 1600,
              step: 10,
              presets: WIDTH_PRESETS,
              peek: layoutPeek('contentWidth'),
            },
            layoutSwitch('centerContent'),
            layoutSwitch('feedTabsStatic'),
            ...hideControls('posts'),
          ],
        },
        {
          titleKey: 'interface.sectionNav',
          descKey: 'interface.sectionNavDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.layout' },
            layoutSwitch('menuLeft'),
            layoutSwitch('menuCenter'),
            ...hideControls('nav'),
          ],
        },
        {
          titleKey: 'interface.sectionSide',
          descKey: 'interface.sectionSideDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.layout' },
            layoutSwitch('sidebarRight'),
            ...hideControls('sidebar'),
          ],
        },
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
