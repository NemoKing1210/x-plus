import { exportSettings, importSettings } from '../../../core/settings.js';
import { t } from '../../../i18n/index.js';
import { showToast } from '../../../ui/toast.js';
import { el } from '../../../utils/dom.js';
import { createButton, createButtonRow, createHint, createSection } from '../controls.js';
import { reloadDraft } from '../panel.js';

/**
 * Backup tab: export / import the whole settings object as JSON. Both actions
 * are immediate (they bypass the Save footer) because a backup is a snapshot of
 * what is persisted, not of the unsaved draft.
 */

function downloadText(fileName, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function applyImport(json) {
  try {
    importSettings(json);
  } catch {
    showToast(t('backup.importFailed'), { type: 'error', force: true });
    return;
  }
  reloadDraft();
  showToast(t('backup.imported'), { type: 'success' });
}

function render() {
  const root = el('div', 'xp-tab');

  const exportBlock = createSection({
    title: t('backup.exportTitle'),
    desc: t('backup.exportDesc'),
  });
  exportBlock.body.appendChild(
    createButtonRow(
      createButton({
        label: t('backup.download'),
        onClick: () => {
          downloadText('x-plus-settings.json', exportSettings());
          showToast(t('backup.exported'), { type: 'success' });
        },
      }),
      createButton({
        label: t('backup.copy'),
        onClick: async () => {
          const ok = await copyText(exportSettings());
          showToast(ok ? t('backup.copied') : t('backup.copyFailed'), {
            type: ok ? 'success' : 'warning',
            force: true,
          });
        },
      }),
    ),
  );
  exportBlock.body.appendChild(createHint(t('backup.secretsHint')));

  const importBlock = createSection({
    title: t('backup.importTitle'),
    desc: t('backup.importDesc'),
  });
  const textarea = el('textarea', 'xp-textarea');
  textarea.rows = 6;
  textarea.spellcheck = false;
  textarea.placeholder = '{ "general": { … }, "translate": { … } }';

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  file.addEventListener('change', async () => {
    const picked = file.files?.[0];
    file.value = '';
    if (!picked) return;
    applyImport(await picked.text());
  });

  importBlock.body.append(
    textarea,
    createButtonRow(
      createButton({
        label: t('backup.importPaste'),
        onClick: () => {
          if (!textarea.value.trim()) return;
          applyImport(textarea.value);
          textarea.value = '';
        },
      }),
      createButton({ label: t('backup.importFile'), onClick: () => file.click() }),
    ),
    file,
  );

  root.append(exportBlock.section, importBlock.section);
  return root;
}

export const backupTab = {
  id: 'backup',
  titleKey: 'backup.title',
  render,
};
