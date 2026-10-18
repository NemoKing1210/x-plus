import { el } from '../../utils/dom.js';

/**
 * Low-level settings controls. Each builder returns plain DOM and reports
 * edits through a callback; binding to the draft and visibility rules live in
 * renderer.js. Styles: styles/settings.css (`xp-` prefix).
 */

/** Row wrapper — the unit that `showIf` hides. */
export function createRow(className = '') {
  return el('div', `xp-row${className ? ` ${className}` : ''}`);
}

export function createSection({ title, desc }) {
  const section = el('section', 'xp-section');
  const head = el('header', 'xp-section__head');
  if (title) head.appendChild(el('h3', 'xp-section__title', title));
  if (desc) head.appendChild(el('p', 'xp-section__desc', desc));
  section.appendChild(head);
  const body = el('div', 'xp-section__body');
  section.appendChild(body);
  return { section, body };
}

export function createHint(text) {
  return el('p', 'xp-hint', text);
}

/** Small title that splits a section into logical parts. */
export function createSubheading(text) {
  const row = createRow('xp-subheading');
  row.appendChild(el('h4', 'xp-subheading__title', text));
  return row;
}

/** Toggle switch row (X settings style). */
export function createSwitch({ label, hint, checked, onChange }) {
  const row = createRow();
  const wrap = el('label', 'xp-check');
  const text = el('span', 'xp-check__text');
  text.appendChild(el('span', 'xp-check__title', label));
  if (hint) text.appendChild(el('span', 'xp-check__hint', hint));
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));
  wrap.append(text, input, el('span', 'xp-check__track'));
  wrap.lastChild.setAttribute('aria-hidden', 'true');
  row.appendChild(wrap);
  return { row, input };
}

function fieldShell(label, hint, control) {
  const row = createRow();
  const wrap = el('label', 'xp-field');
  if (label) wrap.appendChild(el('span', 'xp-field__label', label));
  wrap.appendChild(control);
  if (hint) wrap.appendChild(el('span', 'xp-field__hint', hint));
  row.appendChild(wrap);
  return row;
}

/** @param {{value: string, label: string}[]} options */
export function createSelect({ label, hint, options, value, onChange }) {
  const select = document.createElement('select');
  fillSelect(select, options, value);
  select.addEventListener('change', () => onChange(select.value));
  return { row: fieldShell(label, hint, select), input: select };
}

export function fillSelect(select, options, value) {
  select.replaceChildren(
    ...options.map((option) => {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      node.selected = String(option.value) === String(value);
      return node;
    }),
  );
}

export function createNumber({ label, hint, value, min, max, step = 1, onChange }) {
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  input.step = String(step);
  input.value = String(value ?? '');
  input.addEventListener('input', () => {
    const parsed = input.value === '' ? NaN : Number(input.value);
    onChange(Number.isFinite(parsed) ? parsed : null);
  });
  return { row: fieldShell(label, hint, input), input };
}

/**
 * Range slider with a live value readout and preset chips.
 * `format(value)` renders the readout; `presets` is [{ value, label }].
 */
export function createSlider({ label, hint, value, min, max, step = 1, presets = [], format, onChange }) {
  const show = format ?? String;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const readout = el('span', 'xp-slider__value');
  const chips = el('div', 'xp-slider__presets');
  const buttons = presets.map((preset) => {
    const chip = createButton({
      label: preset.label,
      compact: true,
      onClick: () => update(preset.value, true),
    });
    chips.appendChild(chip);
    return { chip, value: preset.value };
  });

  function update(next, notify) {
    input.value = String(next);
    readout.textContent = show(Number(next));
    for (const { chip, value: v } of buttons) {
      chip.classList.toggle('is-active', v === Number(next));
    }
    if (notify) onChange(Number(next));
  }
  input.addEventListener('input', () => update(input.value, true));
  update(value ?? min, false);

  const head = el('div', 'xp-slider__head');
  head.append(el('span', 'xp-field__label', label), readout);
  const row = createRow();
  const wrap = el('div', 'xp-field xp-slider');
  wrap.append(head, input);
  if (presets.length) wrap.appendChild(chips);
  if (hint) wrap.appendChild(el('span', 'xp-field__hint', hint));
  row.appendChild(wrap);
  return { row, input };
}

/** @param {'text'|'password'|'url'} type */
export function createTextInput({ label, hint, value, type = 'text', placeholder, onChange }) {
  const input = document.createElement('input');
  input.type = type;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (placeholder) input.placeholder = placeholder;
  input.value = value ?? '';
  input.addEventListener('input', () => onChange(input.value));
  return { row: fieldShell(label, hint, input), input };
}

export function createButton({ label, variant = 'ghost', onClick, compact = false }) {
  const button = el(
    'button',
    `xp-btn-ui xp-btn-ui--${variant}${compact ? ' xp-btn-ui--compact' : ''}`,
    label,
  );
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

export function createButtonRow(...buttons) {
  const row = createRow('xp-row--actions');
  row.append(...buttons);
  return row;
}

/**
 * Chip-list editor: an input (or select) plus an Add button and the current
 * items as removable chips.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.hint]
 * @param {string[]} options.items
 * @param {(item: string) => string} options.formatItem   - chip text
 * @param {() => HTMLElement} options.createInput          - fresh input/select for the add row
 * @param {(input: HTMLElement) => string} options.readInput
 * @param {(input: HTMLElement, items: string[]) => void} [options.afterChange]
 * @param {string} options.addLabel
 * @param {string} options.removeLabel
 * @param {string} options.emptyText
 * @param {(raw: string, items: string[]) => {ok: true, value: string} | {ok: false, message: string}} options.validate
 * @param {(items: string[]) => void} options.onChange
 */
export function createListEditor(options) {
  const row = createRow('xp-list-editor');
  const head = el('div', 'xp-list-editor__head');
  head.appendChild(el('div', 'xp-list-editor__title', options.title));
  if (options.hint) head.appendChild(el('p', 'xp-list-editor__hint', options.hint));

  const add = el('div', 'xp-allowlist-add');
  const input = options.createInput();
  const addButton = createButton({ label: options.addLabel, compact: true, onClick: submit });
  add.append(input, addButton);

  const host = el('div', 'xp-list-editor__host');
  let items = [...options.items];

  function paint() {
    if (!items.length) {
      host.replaceChildren(el('p', 'xp-empty', options.emptyText));
    } else {
      const list = el('ul', 'xp-allowlist');
      for (const item of items) {
        const li = el('li', 'xp-allowlist__item');
        li.appendChild(el('span', 'xp-allowlist__handle', options.formatItem(item)));
        const remove = el('button', 'xp-allowlist__remove', '×');
        remove.type = 'button';
        remove.setAttribute('aria-label', options.removeLabel);
        remove.addEventListener('click', () => {
          items = items.filter((x) => x !== item);
          commit();
        });
        li.appendChild(remove);
        list.appendChild(li);
      }
      host.replaceChildren(list);
    }
    options.afterChange?.(input, items);
  }

  function commit() {
    options.onChange([...items]);
    paint();
  }

  function submit() {
    const result = options.validate(options.readInput(input), items);
    if (!result.ok) {
      options.onReject?.(result.message);
      return;
    }
    items = [...items, result.value].sort();
    if (input instanceof HTMLInputElement) {
      input.value = '';
      input.focus();
    }
    commit();
  }

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  });

  row.append(head, add, host);
  paint();
  return { row };
}

/** Meter bar used for the translation cache usage. */
export function createMeter({ title }) {
  const root = el('div', 'xp-meter');
  root.innerHTML =
    '<div class="xp-meter__top"><div class="xp-meter__title"></div><div class="xp-meter__pct"></div></div>' +
    '<div class="xp-meter__used"></div>' +
    '<div class="xp-meter__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span class="xp-meter__fill"></span></div>' +
    '<div class="xp-meter__meta"></div>' +
    '<p class="xp-meter__hint"></p>';
  root.querySelector('.xp-meter__title').textContent = title;
  return root;
}
