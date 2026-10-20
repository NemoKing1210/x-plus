import { t } from '../../i18n/index.js';

/**
 * Settings search. The index is built from the declarative tab specs (not from
 * the DOM), so tabs that were never opened are searchable too and the result
 * list is instant. Every control / section node gets `data-xp-find="<id>"`
 * from the renderer, which is how a result is scrolled to and highlighted.
 */

const ids = new WeakMap();
let nextId = 1;

/** Stable id of a spec object (the renderer and the index share it). */
export function findId(spec) {
  let id = ids.get(spec);
  if (!id) {
    id = `f${nextId}`;
    nextId += 1;
    ids.set(spec, id);
  }
  return id;
}

/** Lower case; `ё` = `е` (same length, so highlight offsets stay valid). */
const fold = (text) => String(text || '').toLowerCase().replace(/ё/g, 'е');

const tr = (key) => (key ? t(key) : '');

function optionText(spec) {
  let options = spec.options;
  try {
    if (typeof options === 'function') options = options();
  } catch {
    return '';
  }
  return (options || []).map((option) => option.label ?? tr(option.labelKey)).join(' ');
}

/**
 * @typedef {{ id: string, kind: 'tab' | 'section' | 'control', tabId: string,
 *   tabTitle: string, sectionTitle: string, label: string, hint: string,
 *   extra: string, hay: string }} Entry
 */

function pushControl(entries, base, spec) {
  switch (spec.type) {
    case 'group':
      for (const child of spec.controls || []) pushControl(entries, base, child);
      return;
    case 'list':
      add(entries, base, 'control', findId(spec), tr(spec.titleKey), tr(spec.hintKey), '');
      return;
    case 'button':
      add(entries, base, 'control', findId(spec), tr(spec.labelKey), '', '');
      return;
    case 'switch':
    case 'select':
    case 'number':
    case 'slider':
    case 'hotkey':
    case 'text':
    case 'password':
    case 'url':
      add(entries, base, 'control', findId(spec), tr(spec.labelKey), tr(spec.hintKey), spec.type === 'select' ? optionText(spec) : '');
      return;
    default:
  }
}

function add(entries, base, kind, id, label, hint, extra) {
  if (!label) return;
  entries.push({
    ...base,
    id,
    kind,
    label,
    hint,
    extra,
    hay: fold([label, hint, extra, base.sectionTitle, base.tabTitle].join(' \n ')),
  });
}

/** @returns {Entry[]} */
export function buildIndex(tabs) {
  const entries = [];
  for (const tab of tabs) {
    const tabTitle = tr(tab.titleKey);
    const tabBase = { tabId: tab.id, tabTitle, sectionTitle: '', sectionId: '' };
    add(entries, tabBase, 'tab', `tab:${tab.id}`, tabTitle, '', '');
    for (const section of tab.sections || []) {
      const sectionTitle = tr(section.titleKey);
      const base = { tabId: tab.id, tabTitle, sectionTitle, sectionId: findId(section) };
      if (sectionTitle) add(entries, base, 'section', findId(section), sectionTitle, tr(section.descKey), '');
      for (const control of section.controls || []) pushControl(entries, base, control);
    }
  }
  return entries;
}

/** Words of a query (folded). */
export function tokenize(query) {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Entries matching every word, best first. */
export function searchIndex(index, query, limit = 40) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const scored = [];
  index.forEach((entry, order) => {
    if (!tokens.every((token) => entry.hay.includes(token))) return;
    const label = fold(entry.label);
    const title = fold(`${entry.sectionTitle} ${entry.tabTitle}`);
    let score = entry.kind === 'control' ? 0 : entry.kind === 'section' ? 2 : 1;
    for (const token of tokens) {
      if (label.startsWith(token)) score += 12;
      else if (label.includes(` ${token}`)) score += 9;
      else if (label.includes(token)) score += 6;
      else if (title.includes(token)) score += 3;
      else score += 1;
    }
    scored.push({ entry, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, limit).map((item) => item.entry);
}

/** `text` as a fragment with the matched words wrapped in <mark>. */
export function highlight(text, tokens) {
  const fragment = document.createDocumentFragment();
  const source = String(text || '');
  if (!tokens.length) {
    fragment.append(source);
    return fragment;
  }
  const folded = fold(source);
  if (folded.length !== source.length) {
    fragment.append(source);
    return fragment;
  }
  const marks = new Array(source.length).fill(false);
  for (const token of tokens) {
    for (let at = folded.indexOf(token); at !== -1; at = folded.indexOf(token, at + token.length)) {
      for (let i = at; i < at + token.length; i += 1) marks[i] = true;
    }
  }
  let i = 0;
  while (i < source.length) {
    let j = i;
    while (j < source.length && marks[j] === marks[i]) j += 1;
    const chunk = source.slice(i, j);
    if (marks[i]) {
      const mark = document.createElement('mark');
      mark.textContent = chunk;
      fragment.append(mark);
    } else {
      fragment.append(chunk);
    }
    i = j;
  }
  return fragment;
}
