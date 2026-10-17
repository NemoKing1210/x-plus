import { getPath, setPath } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { showToast } from '../../ui/toast.js';
import { el } from '../../utils/dom.js';
import { fmt } from '../../utils/format.js';
import { normalizeHandle, formatHandleDisplay } from '../../utils/handle.js';
import { normalizeLangCode } from '../../utils/lists.js';
import {
  createButton,
  createButtonRow,
  createHint,
  createListEditor,
  createNumber,
  createRow,
  createSection,
  createSelect,
  createSlider,
  createSwitch,
  createTextInput,
  fillSelect,
} from './controls.js';

/**
 * Turns a declarative tab spec into DOM bound to the settings draft.
 *
 * Tab spec:
 *   { id, titleKey, badge?(rootDraft) → string, sections: SectionSpec[] }
 *   or, for fully custom tabs: { id, titleKey, badge?, render(ctx) → Node }
 *
 * Section spec:
 *   { titleKey?, descKey?, showIf?, controls: ControlSpec[] }
 *
 * Control spec (`path` is relative to the owning feature's settings):
 *   { type: 'switch',  path, labelKey, hintKey? }
 *   { type: 'select',  path, labelKey, hintKey?, options | () => options, onChange? }
 *   { type: 'number',  path, labelKey, hintKey?, min?, max?, step? }
 *   { type: 'slider',  path, labelKey, hintKey?, min, max, step?, presets?: [{ value, labelKey }], formatKey? }
 *   { type: 'text' | 'password' | 'url', path, labelKey, hintKey?, placeholder? }
 *   { type: 'list',    path, kind: 'handle' | 'lang', titleKey, hintKey?, ... }
 *   { type: 'hint',    textKey }
 *   { type: 'button',  labelKey, variant?, onClick(ctx) }
 *   { type: 'group',   controls: ControlSpec[] }
 *   { type: 'custom',  render(ctx) → Node }
 * Every control (and section) accepts `showIf(section, root) → boolean`.
 * Select options: [{ value, labelKey } | { value, label }].
 *
 * Context handed to custom renderers / callbacks:
 *   { root, section, featureId, changed(), subscribe(fn), rerender() }
 */

const label = (key) => (key ? t(key) : '');

function resolveOptions(spec) {
  const options = typeof spec.options === 'function' ? spec.options() : spec.options;
  return options.map((option) => ({
    value: option.value,
    label: option.label ?? t(option.labelKey),
  }));
}

/** @returns {{ root: HTMLElement, refresh: () => void }} */
export function renderTab(tab, { draft, featureId, onChange, rerender }) {
  const rootEl = el('div', 'xp-tab');
  /** @type {Array<() => void>} */
  const subscribers = [];
  const visibility = [];

  const ctx = {
    root: draft,
    section: draft[featureId] ?? {},
    featureId,
    changed() {
      refresh();
      onChange?.();
    },
    subscribe(fn) {
      subscribers.push(fn);
    },
    rerender,
  };

  function refresh() {
    for (const { node, showIf } of visibility) {
      node.hidden = !showIf(ctx.section, ctx.root);
    }
    for (const fn of subscribers) fn();
  }

  const get = (spec) => getPath(ctx.section, spec.path);
  const set = (spec, value) => {
    setPath(ctx.section, spec.path, value);
    ctx.changed();
  };

  function build(spec) {
    switch (spec.type) {
      case 'switch':
        return createSwitch({
          label: label(spec.labelKey),
          hint: label(spec.hintKey),
          checked: get(spec),
          onChange: (value) => set(spec, value),
        }).row;
      case 'select': {
        const control = createSelect({
          label: label(spec.labelKey),
          hint: label(spec.hintKey),
          options: resolveOptions(spec),
          value: get(spec),
          onChange: (value) => {
            setPath(ctx.section, spec.path, value);
            spec.onChange?.(value, ctx);
            ctx.changed();
          },
        });
        return control.row;
      }
      case 'number':
        return createNumber({
          label: label(spec.labelKey),
          hint: label(spec.hintKey),
          value: get(spec),
          min: spec.min,
          max: spec.max,
          step: spec.step,
          onChange: (value) => set(spec, value),
        }).row;
      case 'slider':
        return createSlider({
          label: label(spec.labelKey),
          hint: label(spec.hintKey),
          value: get(spec),
          min: spec.min,
          max: spec.max,
          step: spec.step,
          presets: (spec.presets ?? []).map((p) => ({ value: p.value, label: t(p.labelKey) })),
          format: (v) => (v === 0 && spec.zeroKey ? t(spec.zeroKey) : `${v} px`),
          onChange: (value) => set(spec, value),
        }).row;
      case 'text':
      case 'password':
      case 'url':
        return createTextInput({
          label: label(spec.labelKey),
          hint: label(spec.hintKey),
          type: spec.type,
          value: get(spec),
          placeholder: spec.placeholder,
          onChange: (value) => set(spec, value),
        }).row;
      case 'list':
        return buildList(spec);
      case 'hint':
        return createHint(label(spec.textKey));
      case 'button':
        return createButtonRow(
          createButton({
            label: label(spec.labelKey),
            variant: spec.variant,
            onClick: () => spec.onClick(ctx),
          }),
        );
      case 'group': {
        const group = createRow('xp-group');
        for (const child of spec.controls) appendControl(group, child);
        return group;
      }
      case 'custom':
        return spec.render(ctx);
      default:
        return null;
    }
  }

  function buildList(spec) {
    const isHandle = spec.kind === 'handle';
    const normalize = isHandle ? normalizeHandle : normalizeLangCode;
    const format = isHandle ? formatHandleDisplay : spec.formatItem;
    const editor = createListEditor({
      title: label(spec.titleKey),
      hint: label(spec.hintKey),
      items: get(spec) ?? [],
      formatItem: format,
      addLabel: label(spec.addKey || 'list.add'),
      removeLabel: label('list.remove'),
      emptyText: label(spec.emptyKey || 'list.empty'),
      createInput: () => {
        if (isHandle) {
          const input = document.createElement('input');
          input.type = 'text';
          input.autocomplete = 'off';
          input.spellcheck = false;
          input.placeholder = label(spec.placeholderKey || 'list.handlePlaceholder');
          return input;
        }
        const select = document.createElement('select');
        fillSelect(select, spec.pickerOptions(get(spec) ?? []), '');
        return select;
      },
      readInput: (input) => input.value,
      afterChange: (input, items) => {
        if (!isHandle) fillSelect(input, spec.pickerOptions(items), '');
      },
      validate: (raw, items) => {
        const value = normalize(raw);
        if (!value) return { ok: false, message: label('list.invalid') };
        if (items.includes(value)) {
          return {
            ok: false,
            message: fmt(label('list.exists'), { item: format(value) }),
          };
        }
        return { ok: true, value };
      },
      onReject: (message) => showToast(message, { type: 'warning', force: true }),
      onChange: (items) => set(spec, items),
    });
    return editor.row;
  }

  function appendControl(parent, spec) {
    const node = build(spec);
    if (!node) return;
    if (spec.showIf) visibility.push({ node, showIf: spec.showIf });
    parent.appendChild(node);
  }

  for (const sectionSpec of tab.sections || []) {
    const { section, body } = createSection({
      title: label(sectionSpec.titleKey),
      desc: label(sectionSpec.descKey),
    });
    if (sectionSpec.showIf) visibility.push({ node: section, showIf: sectionSpec.showIf });
    for (const control of sectionSpec.controls) appendControl(body, control);
    rootEl.appendChild(section);
  }

  if (typeof tab.render === 'function') rootEl.appendChild(tab.render(ctx));

  refresh();
  return { root: rootEl, refresh, ctx };
}
