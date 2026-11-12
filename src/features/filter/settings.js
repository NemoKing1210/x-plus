import { t } from '../../i18n/index.js';
import { showToast } from '../../ui/toast.js';
import { el } from '../../utils/dom.js';
import { fmt } from '../../utils/format.js';
import {
  createButton,
  createHint,
  createSection,
  createSelect,
  createSubheading,
  createSwitch,
  createTextInput,
} from '../settings/controls.js';
import { TARGET_LANGUAGES } from '../translate/languages.js';
import { FIELDS, FIELD_NAMES, LIMITS, newCondition, newRule, takesValue } from './config.js';
import { clearPreview, previewRule } from './engine.js';
import { conditionProblem } from './match.js';

/**
 * Rule builder tab. The draft is the source of truth: structural edits (add /
 * remove / move / field / operator) repaint the rule list locally, while text
 * edits only update the draft so the input keeps focus. Test previews one
 * draft rule on the live page for four seconds.
 */

const enumLabel = (field, value) => t(`filter.value.${field}.${value}`);
const fieldLabel = (name) => t(`filter.field.${name}`);
const opLabel = (op) => t(`filter.op.${op}`);

let datalistSeq = 0;

/** First value of an enum field, so a fresh select never shows a value the draft lacks. */
function defaultValue(fieldName) {
  const spec = FIELDS[fieldName];
  return Array.isArray(spec?.value) ? spec.value[0] : '';
}

function paintHint(slot, condition) {
  const problem = conditionProblem(condition);
  if (problem === 'regex') {
    const hint = createHint(t('filter.invalidRegex'));
    hint.classList.add('xp-filter-cond__hint', 'is-invalid');
    slot.replaceChildren(hint);
  } else if (problem === 'incomplete') {
    const hint = createHint(t('filter.incomplete'));
    hint.classList.add('xp-filter-cond__hint', 'is-incomplete');
    slot.replaceChildren(hint);
  } else {
    slot.replaceChildren();
  }
}

function buildValue(condition, refreshHint, commit) {
  const spec = FIELDS[condition.field];
  if (!spec || !takesValue(condition.op)) return null;

  if (Array.isArray(spec.value)) {
    const control = createSelect({
      label: '',
      options: spec.value.map((value) => ({ value, label: enumLabel(condition.field, value) })),
      value: condition.value,
      onChange: (value) => {
        // Valid enum values cannot become incomplete, so no text repaint needed.
        condition.value = value;
        commit();
      },
    });
    control.input.setAttribute('aria-label', t('filter.valuePlaceholder'));
    return control.row;
  }

  const placeholder =
    spec.value === 'lang'
      ? t('filter.langPlaceholder')
      : spec.value === 'handle'
        ? t('filter.handlePlaceholder')
        : t('filter.valuePlaceholder');
  const control = createTextInput({
    label: '',
    value: condition.value,
    placeholder,
    onChange: (value) => {
      condition.value = value;
      refreshHint();
      commit();
    },
  });
  control.input.maxLength = LIMITS.value;
  control.input.setAttribute('aria-label', t('filter.valuePlaceholder'));

  if (spec.value === 'lang') {
    datalistSeq += 1;
    const listId = `xp-filter-lang-${datalistSeq}`;
    control.input.setAttribute('list', listId);
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    for (const lang of TARGET_LANGUAGES) {
      const option = document.createElement('option');
      option.value = lang.code;
      option.label = lang.name;
      datalist.appendChild(option);
    }
    control.row.appendChild(datalist);
  }

  return control.row;
}

function conditionRow(rule, condition, index, repaint, commit) {
  const row = el('div', 'xp-filter-cond');
  const controls = el('div', 'xp-filter-cond__row');
  const hintSlot = el('div', 'xp-filter-cond__hint-slot');
  const refreshHint = () => paintHint(hintSlot, condition);

  const field = createSelect({
    label: '',
    options: FIELD_NAMES.map((name) => ({ value: name, label: fieldLabel(name) })),
    value: condition.field,
    onChange: (value) => {
      condition.field = value;
      condition.op = FIELDS[value].ops[0];
      condition.value = defaultValue(value);
      repaint();
    },
  });
  field.input.setAttribute('aria-label', t('filter.fieldLabel'));
  controls.appendChild(field.row);

  const operators = FIELDS[condition.field]?.ops ?? [];
  const op = createSelect({
    label: '',
    options: operators.map((name) => ({ value: name, label: opLabel(name) })),
    value: condition.op,
    onChange: (value) => {
      condition.op = value;
      if (!takesValue(value)) condition.value = '';
      else if (!condition.value) condition.value = defaultValue(condition.field);
      repaint();
    },
  });
  op.input.setAttribute('aria-label', t('filter.opLabel'));
  controls.appendChild(op.row);

  const value = buildValue(condition, refreshHint, commit);
  if (value) controls.appendChild(value);

  const remove = createButton({
    label: '×',
    compact: true,
    onClick: () => {
      rule.conditions = rule.conditions.filter((_, i) => i !== index);
      repaint();
    },
  });
  remove.setAttribute('aria-label', t('filter.removeCondition'));
  remove.classList.add('xp-filter-cond__remove');
  controls.appendChild(remove);

  row.append(controls, hintSlot);
  refreshHint();
  return row;
}

export function renderFilterTab(ctx) {
  const section = ctx.section;
  const root = el('div', 'xp-tab');
  let peekTimer = 0;

  const main = createSection({ title: t('filter.sectionMain') });
  main.body.appendChild(
    createSwitch({
      label: t('filter.enabled'),
      hint: t('filter.enabledHint'),
      checked: section.enabled,
      onChange: (value) => {
        section.enabled = value;
        ctx.changed();
      },
    }).row,
  );

  const rules = createSection({
    title: t('filter.sectionRules'),
    desc: t('filter.sectionRulesDesc'),
  });
  const list = el('div', 'xp-filter-list');
  const addRow = el('div', 'xp-row xp-row--actions');
  const limitHint = el('div', 'xp-filter-limit');
  rules.body.append(list, addRow, limitHint);
  root.append(main.section, rules.section);

  const commit = () => ctx.changed();
  const repaint = () => {
    ctx.changed();
    paint();
  };

  function moveRule(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= section.rules.length) return;
    const next = [...section.rules];
    [next[index], next[target]] = [next[target], next[index]];
    section.rules = next;
    repaint();
  }

  function testRule(rule) {
    const count = previewRule(rule);
    document.querySelector('.xp-settings-backdrop')?.classList.add('is-peeking');
    showToast(fmt(t('filter.testResult'), { count }), { type: count ? 'success' : 'info' });
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      clearPreview();
      document.querySelector('.xp-settings-backdrop')?.classList.remove('is-peeking');
    }, 4000);
  }

  function ruleCard(rule, index) {
    const card = el('div', 'xp-filter-rule');

    const head = el('div', 'xp-filter-rule__head');
    const toggle = createSwitch({
      label: '',
      checked: rule.enabled,
      onChange: (value) => {
        rule.enabled = value;
        commit();
      },
    });
    toggle.input.setAttribute('aria-label', t('filter.ruleEnabled'));
    toggle.row.classList.add('xp-filter-rule__toggle');
    head.appendChild(toggle.row);

    const name = el('input', 'xp-filter-rule__name');
    name.type = 'text';
    name.autocomplete = 'off';
    name.spellcheck = false;
    name.maxLength = LIMITS.name;
    name.placeholder = t('filter.ruleNamePlaceholder');
    name.value = rule.name;
    name.addEventListener('input', () => {
      rule.name = name.value;
      commit();
    });
    head.appendChild(name);

    const actions = el('div', 'xp-filter-rule__actions');
    const up = createButton({
      label: '↑',
      compact: true,
      onClick: () => moveRule(index, -1),
    });
    up.setAttribute('aria-label', t('filter.moveUp'));
    up.disabled = index === 0;
    const down = createButton({
      label: '↓',
      compact: true,
      onClick: () => moveRule(index, 1),
    });
    down.setAttribute('aria-label', t('filter.moveDown'));
    down.disabled = index === section.rules.length - 1;
    const remove = createButton({
      label: '×',
      compact: true,
      onClick: () => {
        section.rules = section.rules.filter((_, i) => i !== index);
        repaint();
      },
    });
    remove.setAttribute('aria-label', t('filter.removeRule'));
    remove.classList.add('xp-filter-rule__remove');
    actions.append(up, down, remove);
    head.appendChild(actions);
    card.appendChild(head);

    const mode = createSelect({
      label: t('filter.match'),
      options: [
        { value: 'all', label: t('filter.matchAll') },
        { value: 'any', label: t('filter.matchAny') },
      ],
      value: rule.match,
      onChange: (value) => {
        rule.match = value;
        commit();
      },
    });
    card.appendChild(mode.row);

    card.appendChild(createSubheading(t('filter.conditions')));

    const conditions = el('div', 'xp-filter-conditions');
    rule.conditions.forEach((condition, conditionIndex) => {
      conditions.appendChild(conditionRow(rule, condition, conditionIndex, repaint, commit));
    });
    card.appendChild(conditions);

    const actionsRow = el('div', 'xp-row xp-row--actions');
    const addCondition = createButton({
      label: t('filter.addCondition'),
      compact: true,
      onClick: () => {
        rule.conditions = [...rule.conditions, newCondition()];
        repaint();
      },
    });
    addCondition.disabled = rule.conditions.length >= LIMITS.conditions;
    const test = createButton({
      label: t('filter.test'),
      compact: true,
      onClick: () => testRule(rule),
    });
    actionsRow.append(addCondition, test);
    card.appendChild(actionsRow);

    if (rule.conditions.length >= LIMITS.conditions) {
      card.appendChild(createHint(fmt(t('filter.limitConditions'), { max: LIMITS.conditions })));
    }

    return card;
  }

  function paint() {
    list.replaceChildren();
    addRow.replaceChildren();
    limitHint.replaceChildren();

    if (!section.rules.length) {
      list.appendChild(el('p', 'xp-empty', t('filter.empty')));
    } else {
      section.rules.forEach((rule, index) => list.appendChild(ruleCard(rule, index)));
    }

    const atLimit = section.rules.length >= LIMITS.rules;
    const add = createButton({
      label: t('filter.addRule'),
      variant: 'primary',
      compact: true,
      onClick: () => {
        section.rules = [...section.rules, newRule()];
        repaint();
      },
    });
    add.disabled = atLimit;
    addRow.appendChild(add);
    if (atLimit) limitHint.appendChild(createHint(fmt(t('filter.limitRules'), { max: LIMITS.rules })));
  }

  paint();
  return root;
}
