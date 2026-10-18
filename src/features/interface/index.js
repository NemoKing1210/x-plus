import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { applyRuleStyles, endPeek, markRuleTargets, peekLayout, peekPosts, peekRule } from './engine.js';
import { AVATAR_SHAPES, CARD_STYLES, POST_VIEW_FIELDS } from './posts.js';
import { RULES, RULE_GROUPS, ruleId, ruleLabelKey } from './rules.js';

/** One boolean field per rule, grouped (`posts.promoted`, …). */
function ruleFields() {
  const groups = {};
  for (const group of RULE_GROUPS) groups[group] = {};
  for (const rule of RULES.filter((candidate) => !candidate.view)) {
    groups[rule.group][rule.key] = field.bool(Boolean(rule.on));
  }
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

/** Hovering a post-appearance control previews the whole draft on the feed. */
const postPeek = { enter: (section) => peekPosts(section.postView), leave: endPeek };

const withCards = (section) => section.postView.cards;

const postControl = (type, key, extra = {}) => ({
  type,
  path: `postView.${key}`,
  labelKey: `interface.postView.${key}`,
  hintKey: `interface.postView.${key}Hint`,
  peek: postPeek,
  ...extra,
});

const whenEnabled = (section) => section.enabled;
const sidebarHidden = (section) => section.sidebarHide;
const menuHidden = (section) => section.menuHide;

/** "Hide" subheading plus one switch per rule of `group` (needs the master switch). */
function hideControls(group, part) {
  return [
    { type: 'subheading', textKey: 'interface.sub.hide', showIf: whenEnabled },
    ...RULES.filter((rule) => rule.group === group && !rule.view && rule.part === part).map((rule) => ({
      type: 'switch',
      path: `${rule.group}.${rule.key}`,
      labelKey: ruleLabelKey(rule),
      hintKey: rule.hint ? `${ruleLabelKey(rule)}Hint` : undefined,
      peek: rulePeek(rule),
      showIf: whenEnabled,
      // The whole column / menu is hidden: its parts need no switches.
      disabledIf: { sidebar: sidebarHidden, nav: menuHidden }[rule.group],
    })),
  ];
}

const layoutSwitch = (path, extra = {}) => ({
  ...extra,
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
    menuHide: field.bool(false),
    feedTabsStatic: field.bool(false),
    sidebarRight: field.bool(false),
    sidebarHide: field.bool(false),
    centerContent: field.bool(false),
    contentWidth: field.int(0, { min: 0, max: 1600 }),
    postView: field.record(POST_VIEW_FIELDS),
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
          titleKey: 'interface.sectionPosts',
          descKey: 'interface.sectionPostsDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.cards' },
            postControl('switch', 'cards'),
            postControl('select', 'cardStyle', {
              options: CARD_STYLES.map((value) => ({ value, labelKey: `interface.postView.cardStyle.${value}` })),
              showIf: withCards,
            }),
            postControl('slider', 'cardRadius', { min: 0, max: 32, step: 1, showIf: withCards }),
            postControl('slider', 'cardOpacity', {
              min: 0,
              max: 100,
              step: 5,
              unit: '%',
              showIf: (section) => withCards(section) && section.postView.cardStyle === 'filled',
            }),
            { type: 'subheading', textKey: 'interface.sub.spacing' },
            postControl('slider', 'gap', { min: 0, max: 48, step: 2, zeroKey: 'interface.postView.none' }),
            postControl('slider', 'padding', { min: 0, max: 32, step: 2, zeroKey: 'interface.postView.none' }),
            postControl('switch', 'hideDividers', { showIf: (section) => !section.postView.cards }),
            postControl('switch', 'hideFeedBorder'),
            { type: 'subheading', textKey: 'interface.sub.look' },
            postControl('slider', 'textScale', { min: 80, max: 160, step: 5, unit: '%' }),
            // Hides the avatar column (a rule in rules.js); previews what it removes.
            postControl('switch', 'hideAvatars', {
              peek: { enter: () => peekRule('posts.avatars'), leave: endPeek },
            }),
            postControl('select', 'avatarShape', {
              disabledIf: (section) => section.postView.hideAvatars,
              options: AVATAR_SHAPES.map((value) => ({ value, labelKey: `interface.postView.avatarShape.${value}` })),
            }),
            ...hideControls('posts', 'post'),
          ],
        },
        {
          titleKey: 'interface.sectionNav',
          descKey: 'interface.sectionNavDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.layout' },
            layoutSwitch('menuHide'),
            layoutSwitch('menuLeft', { disabledIf: menuHidden }),
            layoutSwitch('menuCenter', { disabledIf: menuHidden }),
            ...hideControls('nav'),
          ],
        },
        {
          titleKey: 'interface.sectionSide',
          descKey: 'interface.sectionSideDesc',
          controls: [
            { type: 'subheading', textKey: 'interface.sub.layout' },
            layoutSwitch('sidebarHide'),
            layoutSwitch('sidebarRight', { disabledIf: sidebarHidden }),
            ...hideControls('sidebar'),
          ],
        },
        {
          titleKey: 'interface.sectionDrawers',
          descKey: 'interface.sectionDrawersDesc',
          controls: hideControls('chrome'),
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
