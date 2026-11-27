import { dom } from '../../core/compat/index.js';
import { updateFeatureSettings } from '../../core/settings.js';
import { icon } from '../../ui/icons.js';
import { openPopup } from '../../ui/popup.js';
import { el } from '../../utils/dom.js';
import { openSettings } from '../settings/panel.js';
import { BACKGROUND_MODES, solidColor, toHexColor } from './background.js';
import { cfg, ss } from './config.js';
import { deliver } from './copy.js';
import { SCALE_MODES } from './naming.js';

/**
 * The capture menu: a compact popover opened from the post's camera button.
 *
 * Layout: five actions (copy / save PNG / save JPEG / copy text / copy link),
 * then quick appearance options that persist immediately, then a link to the
 * full settings tab. Action rows close the menu; option rows keep it open so
 * several choices can be made in one visit.
 */

function action({ id, name, label, hint, primary = false, onSelect }) {
  const button = el(
    'button',
    `xp-shot-menu__action${primary ? ' xp-shot-menu__action--primary' : ''}`,
  );
  button.type = 'button';
  button.dataset.action = id;
  const glyph = el('span', 'xp-shot-menu__icon');
  glyph.innerHTML = icon(name);
  const text = el('span', 'xp-shot-menu__text');
  text.append(
    el('span', 'xp-shot-menu__label', label),
    el('span', 'xp-shot-menu__hint', hint),
  );
  button.append(glyph, text);
  button.addEventListener('click', onSelect);
  return button;
}

function sectionTitle(text) {
  const head = el('div', 'xp-shot-menu__section-title');
  const value = el('span', 'xp-shot-menu__section-value');
  head.append(el('span', '', text), value);
  return { head, value };
}

function backgroundLabel(settings) {
  if (settings.background === 'custom') {
    return solidColor(settings.customBackground) || ss('background.custom');
  }
  return ss(`background.${settings.background}`);
}

function subtitle(article, settings) {
  const handle = dom.getAuthorHandle(article);
  return [
    handle ? `@${handle}` : '',
    ss(`scale.${settings.scale}`),
    backgroundLabel(settings),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Background swatches; the last one wraps a native colour input. */
function buildBackground(settings, onChange) {
  const section = el('section', 'xp-shot-menu__section');
  const { head, value } = sectionTitle(ss('menuBackground'));
  section.appendChild(head);

  const row = el('div', 'xp-shot-menu__swatches');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', ss('menuBackground'));

  /** @type {Map<string, Element>} */
  const swatches = new Map();
  for (const mode of BACKGROUND_MODES) {
    if (mode === 'custom') continue;
    const button = el('button', 'xp-shot-menu__swatch');
    button.type = 'button';
    button.dataset.background = mode;
    button.title = ss(`background.${mode}`);
    button.setAttribute('aria-label', ss(`background.${mode}`));
    button.addEventListener('click', () => {
      updateFeatureSettings('screenshot', { background: mode });
      onChange();
    });
    swatches.set(mode, button);
    row.appendChild(button);
  }

  const custom = el('label', 'xp-shot-menu__swatch xp-shot-menu__swatch--custom');
  custom.title = ss('menuCustomColor');
  const input = document.createElement('input');
  input.type = 'color';
  input.setAttribute('aria-label', ss('menuCustomColor'));
  input.addEventListener('change', () => {
    updateFeatureSettings('screenshot', {
      background: 'custom',
      customBackground: input.value,
    });
    onChange();
  });
  custom.appendChild(input);
  row.appendChild(custom);

  section.appendChild(row);

  return {
    section,
    sync(current) {
      value.textContent = backgroundLabel(current);
      for (const [mode, button] of swatches) {
        const active = current.background === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      input.value = toHexColor(current.customBackground);
      custom.style.setProperty('--xp-shot-color', input.value);
      custom.classList.toggle('is-active', current.background === 'custom');
    },
  };
}

/** Scale segmented control. */
function buildScale(settings, onChange) {
  const section = el('section', 'xp-shot-menu__section');
  const { head } = sectionTitle(ss('menuScale'));
  section.appendChild(head);

  const group = el('div', 'xp-shot-menu__segmented');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', ss('menuScale'));

  /** @type {Map<string, Element>} */
  const segments = new Map();
  for (const mode of SCALE_MODES) {
    const button = el('button', 'xp-shot-menu__segment', ss(`scale.${mode}`));
    button.type = 'button';
    button.dataset.scale = mode;
    button.addEventListener('click', () => {
      updateFeatureSettings('screenshot', { scale: mode });
      onChange();
    });
    segments.set(mode, button);
    group.appendChild(button);
  }

  section.appendChild(group);

  return {
    section,
    sync(current) {
      for (const [mode, button] of segments) {
        const active = current.scale === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      }
    },
  };
}

/** Compact switch for the action row. */
function buildActions(settings, onChange) {
  const row = el('label', 'xp-shot-menu__switch');
  const text = el('span', 'xp-shot-menu__switch-text');
  text.append(
    el('span', 'xp-shot-menu__switch-title', ss('menuActions')),
    el('span', 'xp-shot-menu__switch-hint', ss('menuActionsHint')),
  );
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.addEventListener('change', () => {
    updateFeatureSettings('screenshot', { actions: input.checked });
    onChange();
  });
  row.append(text, input, el('span', 'xp-shot-menu__track'));

  return {
    row,
    sync(current) {
      input.checked = Boolean(current.actions);
    },
  };
}

/** Footer link into Settings → Screenshot. */
function buildFooter(onOpenSettings) {
  const foot = el('div', 'xp-shot-menu__foot');
  const button = el('button', 'xp-shot-menu__settings');
  button.type = 'button';
  button.innerHTML = icon('settings');
  button.appendChild(el('span', '', ss('menuSettings')));
  button.addEventListener('click', onOpenSettings);
  foot.appendChild(button);
  return foot;
}

/** The open menu, so a second click on the same camera closes it. */
let activeMenu = null;

/**
 * Open the capture menu next to `btn` for `article`.
 * @param {Element} article
 * @param {Element} btn
 */
export function openCaptureMenu(article, btn) {
  if (activeMenu?.anchor === btn) {
    activeMenu.close();
    return;
  }

  const settings = cfg();
  let close = () => {};
  let sync = () => {};
  const refresh = () => sync();

  const root = el('div', 'xp-shot-menu');

  const head = el('header', 'xp-shot-menu__head');
  const sub = el('div', 'xp-shot-menu__sub');
  head.append(el('div', 'xp-shot-menu__title', ss('menuTitle')), sub);

  const run = (name, options) => {
    close();
    deliver(article, btn, name, options);
  };

  const actions = el('div', 'xp-shot-menu__actions');
  actions.append(
    action({
      id: 'copy',
      name: 'copy',
      label: ss('menuCopy'),
      hint: ss('menuCopyHint'),
      primary: true,
      onSelect: () => run('copy'),
    }),
    action({
      id: 'save-png',
      name: 'download',
      label: ss('menuSavePng'),
      hint: ss('menuSavePngHint'),
      onSelect: () => run('save', { format: 'png' }),
    }),
    action({
      id: 'save-jpeg',
      name: 'image',
      label: ss('menuSaveJpeg'),
      hint: ss('menuSaveJpegHint'),
      onSelect: () => run('save', { format: 'jpeg' }),
    }),
    el('div', 'xp-shot-menu__divider'),
    action({
      id: 'text',
      name: 'text',
      label: ss('menuCopyText'),
      hint: ss('menuCopyTextHint'),
      onSelect: () => run('text'),
    }),
    action({
      id: 'link',
      name: 'link',
      label: ss('menuCopyLink'),
      hint: ss('menuCopyLinkHint'),
      onSelect: () => run('link'),
    }),
  );

  const background = buildBackground(settings, refresh);
  const scale = buildScale(settings, refresh);
  const actionsSwitch = buildActions(settings, refresh);
  const footer = buildFooter(() => {
    close();
    openSettings('screenshot');
  });

  root.append(
    head,
    actions,
    el('div', 'xp-shot-menu__divider'),
    background.section,
    scale.section,
    actionsSwitch.row,
    footer,
  );

  sync = () => {
    const current = cfg();
    sub.textContent = subtitle(article, current);
    background.sync(current);
    scale.sync(current);
    actionsSwitch.sync(current);
  };
  sync();

  close = openPopup({
    anchor: btn,
    title: ss('menuTitle'),
    content: root,
    className: 'xp-popup--shot',
    onClose: () => {
      if (activeMenu?.anchor === btn) activeMenu = null;
    },
  });
  activeMenu = { anchor: btn, close };
}
