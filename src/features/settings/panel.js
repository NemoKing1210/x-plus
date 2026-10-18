import { SCRIPT_NAME, SCRIPT_VERSION } from '../../core/constants.js';
import { getFeatures } from '../../core/features.js';
import { getDefaults, getSettings, saveSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';
import { icon } from '../../ui/icons.js';
import { lockPageScroll, unlockPageScroll } from '../../ui/scroll-lock.js';
import { showToast } from '../../ui/toast.js';
import { el } from '../../utils/dom.js';
import { confirmDialog } from './confirm.js';
import { endPeek, renderTab } from './renderer.js';
import { buildIndex, highlight, searchIndex, tokenize } from './search.js';

/**
 * Settings dialog shell: header, scrollable tab strip, lazily rendered tab
 * panels and a Reset / Cancel / Save footer. Panels edit a *draft* copy of the
 * settings; nothing is persisted (or applied) until Save.
 */

const ROOT_ID = 'xp-settings-root';

/** @type {null | {
 *   root: HTMLElement, dialog: HTMLElement, draft: object,
 *   tabs: object[], active: string,
 *   rendered: Map<string, { panel: HTMLElement, view: ReturnType<typeof renderTab> }>,
 *   search: null | { input: HTMLInputElement, clear: HTMLElement, results: HTMLElement,
 *     index: object[] | null, found: object[], active: number }
 * }} */
let state = null;

const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));

/** Tabs contributed by every registered feature, in feature order. */
function collectTabs() {
  const tabs = [];
  for (const feature of getFeatures()) {
    for (const tab of feature.tabs || []) tabs.push({ ...tab, featureId: feature.id });
  }
  return tabs;
}

/* ------------------------------------------------------------------ */
/* Tab strip                                                           */
/* ------------------------------------------------------------------ */

function tabButton(tab, active) {
  const button = el('button', `xp-settings__tab${active ? ' is-active' : ''}`);
  button.type = 'button';
  button.id = `xp-tab-${tab.id}`;
  button.dataset.xpTab = tab.id;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', active ? 'true' : 'false');
  button.setAttribute('aria-controls', `xp-panel-${tab.id}`);
  button.tabIndex = active ? 0 : -1;
  button.appendChild(el('span', 'xp-settings__tab-label', t(tab.titleKey)));
  if (tab.badge) button.appendChild(el('span', 'xp-settings__badge'));
  return button;
}

function syncTabInk() {
  const ink = state.dialog.querySelector('.xp-settings__tab-ink');
  const active = state.dialog.querySelector('.xp-settings__tab.is-active');
  if (!ink || !active) return;
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.transform = `translateX(${active.offsetLeft}px)`;
}

function updateBadges() {
  if (!state) return;
  for (const tab of state.tabs) {
    if (!tab.badge) continue;
    const node = state.dialog.querySelector(`#xp-tab-${CSS.escape(tab.id)} .xp-settings__badge`);
    if (!node) continue;
    const text = tab.badge(state.draft);
    node.textContent = text || '';
    node.hidden = !text;
  }
  syncTabInk();
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

function ensurePanel(tab) {
  let entry = state.rendered.get(tab.id);
  if (entry) return entry;

  const panel = el('div', 'xp-settings__panel');
  panel.id = `xp-panel-${tab.id}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `xp-tab-${tab.id}`);
  panel.hidden = true;

  const view = renderTab(tab, {
    draft: state.draft,
    featureId: tab.featureId,
    onChange: updateBadges,
    rerender: rerenderAll,
  });
  panel.appendChild(view.root);
  state.dialog.querySelector('.xp-settings__body').appendChild(panel);

  entry = { panel, view };
  state.rendered.set(tab.id, entry);
  return entry;
}

function activateTab(tabId) {
  const tab = state.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return;
  state.active = tabId;
  ensurePanel(tab);

  state.dialog.querySelectorAll('[data-xp-tab]').forEach((button) => {
    const on = button.dataset.xpTab === tabId;
    button.classList.toggle('is-active', on);
    button.setAttribute('aria-selected', on ? 'true' : 'false');
    button.tabIndex = on ? 0 : -1;
  });
  for (const [id, entry] of state.rendered) {
    const on = id === tabId;
    entry.panel.classList.toggle('is-active', on);
    entry.panel.hidden = !on;
  }
  state.dialog.querySelector('.xp-settings__body').scrollTop = 0;
  syncTabInk();
  state.dialog
    .querySelector('.xp-settings__tab.is-active')
    ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
}

/** Drop every rendered panel and rebuild the active one (reset / import). */
function rerenderAll() {
  if (!state) return;
  for (const { panel } of state.rendered.values()) panel.remove();
  state.rendered.clear();
  activateTab(state.active);
  updateBadges();
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

function setActiveResult(index, scroll = true) {
  const { search } = state;
  const items = [...search.results.querySelectorAll('.xp-hit')];
  search.active = items.length ? Math.max(0, Math.min(items.length - 1, index)) : -1;
  items.forEach((item, i) => {
    const on = i === search.active;
    item.classList.toggle('is-active', on);
    item.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) {
      search.input.setAttribute('aria-activedescendant', item.id);
      if (scroll) item.scrollIntoView({ block: 'nearest' });
    }
  });
}

function renderResults() {
  const { search } = state;
  const query = search.input.value;
  const tokens = tokenize(query);
  search.clear.hidden = !query;
  if (tokens.length) endPeek();
  state.dialog.classList.toggle('is-searching', tokens.length > 0);
  search.results.replaceChildren();
  state.dialog.querySelector('.xp-settings__body').scrollTop = 0;
  search.found = [];
  search.active = -1;
  if (!tokens.length) return;

  search.index ??= buildIndex(state.tabs);
  search.found = searchIndex(search.index, query);
  if (!search.found.length) {
    search.results.appendChild(el('p', 'xp-hits__empty', t('panel.searchEmpty')));
    return;
  }
  search.found.forEach((entry, i) => {
    const item = el('button', 'xp-hit');
    item.type = 'button';
    item.id = `xp-hit-${i}`;
    item.setAttribute('role', 'option');
    item.tabIndex = -1;
    const crumb = [entry.tabTitle, entry.sectionTitle].filter((part) => part && part !== entry.label).join(' › ');
    const title = el('span', 'xp-hit__title');
    title.appendChild(highlight(entry.label, tokens));
    item.appendChild(title);
    if (crumb) item.appendChild(el('span', 'xp-hit__crumb', crumb));
    if (entry.hint) {
      const hint = el('span', 'xp-hit__hint');
      hint.appendChild(highlight(entry.hint, tokens));
      item.appendChild(hint);
    }
    item.addEventListener('mousemove', () => {
      if (search.active !== i) setActiveResult(i, false);
    });
    item.addEventListener('click', () => jumpTo(entry));
    search.results.appendChild(item);
  });
  setActiveResult(0, false);
}

function clearSearch() {
  if (!state?.search) return;
  state.search.input.value = '';
  renderResults();
}

/** Open the tab of a result, scroll to the setting and flash it. */
function jumpTo(entry) {
  clearSearch();
  activateTab(entry.tabId);
  if (entry.kind === 'tab') return;
  const panel = state.rendered.get(entry.tabId)?.panel;
  if (!panel) return;
  const visible = (node) => {
    for (let n = node; n && n !== panel; n = n.parentElement) if (n.hidden) return false;
    return true;
  };
  const pick = (id) => panel.querySelector(`[data-xp-find="${id}"]`);
  let node = pick(entry.id);
  // Hidden by a condition (e.g. its parent switch is off): show the section instead.
  if (!node || !visible(node)) node = entry.sectionId ? pick(entry.sectionId) : null;
  if (!node || !visible(node)) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.remove('is-found');
  void node.offsetWidth;
  node.classList.add('is-found');
  node.addEventListener('animationend', () => node.classList.remove('is-found'), { once: true });
}

function buildSearch() {
  const row = el('div', 'xp-settings__search');
  const box = el('div', 'xp-search');
  const glyph = el('span', 'xp-search__icon');
  glyph.innerHTML = icon('search');
  const input = el('input', 'xp-search__input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = `${t('panel.search')}  ( / )`;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', t('panel.search'));
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'xp-settings-results');
  const clear = el('button', 'xp-search__clear');
  clear.type = 'button';
  clear.hidden = true;
  clear.innerHTML = icon('close');
  clear.setAttribute('aria-label', t('panel.searchClear'));
  clear.title = t('panel.searchClear');
  box.append(glyph, input, clear);
  row.appendChild(box);

  const results = el('div', 'xp-hits');
  results.id = 'xp-settings-results';
  results.setAttribute('role', 'listbox');
  results.setAttribute('aria-label', t('panel.search'));

  input.addEventListener('input', renderResults);
  clear.addEventListener('click', () => {
    clearSearch();
    input.focus();
  });
  input.addEventListener('keydown', (event) => {
    const search = state?.search;
    if (!search) return;
    if (event.key === 'ArrowDown') setActiveResult(search.active + 1);
    else if (event.key === 'ArrowUp') setActiveResult(search.active - 1);
    else if (event.key === 'Enter' && search.found[search.active]) jumpTo(search.found[search.active]);
    else return;
    event.preventDefault();
  });

  return { row, results, search: { input, clear, results, index: null, found: [], active: -1 } };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export const isSettingsOpen = () => Boolean(state);

export function closeSettings() {
  if (!state) return;
  document.removeEventListener('keydown', onKeyDown, true);
  endPeek();
  state.root.remove();
  state = null;
  unlockPageScroll();
}

function onKeyDown(event) {
  if (!state) return;
  // A confirm dialog / popup handles its own keys first.
  if (document.querySelector('.xp-confirm-overlay, .xp-popup')) return;
  const search = state.search?.input;

  // "/" or Ctrl/Cmd+K jumps to the search box (not while typing elsewhere).
  const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
  const shortcut = (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey)
    || ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k');
  if (shortcut && search) {
    event.preventDefault();
    event.stopPropagation();
    search.focus();
    search.select();
    return;
  }

  if (event.key !== 'Escape') return;
  event.stopPropagation();
  // First Escape clears the search, the next one closes the dialog.
  if (search?.value) {
    clearSearch();
    return;
  }
  closeSettings();
}

function save() {
  saveSettings(state.draft);
  showToast(t('panel.saved'), { type: 'success' });
  closeSettings();
}

async function reset() {
  const confirmed = await confirmDialog({
    title: t('panel.resetTitle'),
    message: t('panel.resetText'),
    confirmLabel: t('panel.reset'),
    danger: true,
  });
  if (!confirmed || !state) return;
  state.draft = getDefaults();
  rerenderAll();
}

/**
 * Replace the draft with the persisted settings (used after an import, which
 * is applied immediately and must not be overwritten by a stale draft).
 */
export function reloadDraft() {
  if (!state) return;
  state.draft = cloneSettings(getSettings());
  rerenderAll();
}

/* ------------------------------------------------------------------ */
/* Open                                                                */
/* ------------------------------------------------------------------ */

function buildDialog(tabs, active) {
  const root = el('div', 'xp-settings-backdrop');
  root.id = ROOT_ID;

  const dialog = el('div', 'xp-settings');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'xp-settings-title');

  const header = el('header', 'xp-settings__header');
  const close = el('button', 'xp-settings__x');
  close.type = 'button';
  close.dataset.xpClose = '';
  close.setAttribute('aria-label', t('panel.close'));
  close.innerHTML = icon('close');
  const heading = el('div', 'xp-settings__heading');
  const title = el('h2', '', SCRIPT_NAME);
  title.id = 'xp-settings-title';
  heading.append(title, el('p', 'xp-settings__ver', `v${SCRIPT_VERSION}`));
  header.append(close, heading, el('span', 'xp-settings__header-spacer'));

  const strip = el('div', 'xp-settings__tabs');
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', SCRIPT_NAME);
  strip.appendChild(el('span', 'xp-settings__tab-ink'));
  for (const tab of tabs) strip.appendChild(tabButton(tab, tab.id === active));

  const body = el('div', 'xp-settings__body');
  const searchUi = buildSearch();
  body.appendChild(searchUi.results);

  const actions = el('div', 'xp-settings__actions');
  const resetButton = el('button', 'xp-btn-ui xp-btn-ui--ghost xp-btn-ui--danger', t('panel.reset'));
  const spacer = el('span', 'xp-settings__spacer');
  const cancelButton = el('button', 'xp-btn-ui xp-btn-ui--ghost', t('panel.cancel'));
  const saveButton = el('button', 'xp-btn-ui xp-btn-ui--primary', t('panel.save'));
  for (const button of [resetButton, cancelButton, saveButton]) button.type = 'button';
  resetButton.addEventListener('click', reset);
  cancelButton.addEventListener('click', closeSettings);
  saveButton.addEventListener('click', save);
  actions.append(resetButton, spacer, cancelButton, saveButton);

  dialog.append(header, searchUi.row, strip, body, actions);
  root.appendChild(dialog);

  root.addEventListener('click', (event) => {
    if (event.target === root || event.target.closest?.('[data-xp-close]')) closeSettings();
  });

  strip.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-xp-tab]');
    if (button) activateTab(button.dataset.xpTab);
  });
  strip.addEventListener('keydown', (event) => {
    const buttons = [...strip.querySelectorAll('[data-xp-tab]')];
    const current = event.target.closest?.('[data-xp-tab]');
    if (!current) return;
    const index = buttons.indexOf(current);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + buttons.length) % buttons.length;
    } else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    activateTab(buttons[next].dataset.xpTab);
    buttons[next].focus();
  });

  return { root, dialog, search: searchUi.search };
}

/** Open the settings dialog (optionally on a given tab id). */
export function openSettings(tabId) {
  closeSettings();
  const tabs = collectTabs();
  if (!tabs.length) return;
  const active = tabs.some((tab) => tab.id === tabId) ? tabId : tabs[0].id;

  const { root, dialog, search } = buildDialog(tabs, active);
  state = {
    root,
    dialog,
    draft: cloneSettings(getSettings()),
    tabs,
    active,
    rendered: new Map(),
    search,
  };

  document.addEventListener('keydown', onKeyDown, true);
  (document.body || document.documentElement).appendChild(root);
  lockPageScroll();
  activateTab(active);
  requestAnimationFrame(() => {
    updateBadges();
    syncTabInk();
  });
}
