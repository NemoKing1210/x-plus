import { dom } from '../../core/compat/index.js';
import { Codes, logWarn } from '../../core/debug.js';
import { setButtonLabel } from '../../ui/action-button.js';
import { showToast } from '../../ui/toast.js';
import { saveBlob } from '../../utils/download.js';
import { capturePost } from './capture.js';
import { cfg, ss } from './config.js';
import { formatExtension, postFileName, statusIdFromHref } from './naming.js';
import { showPreview } from './preview.js';

function fileName(article, format = 'png') {
  const handle = dom.getAuthorHandle(article) || '';
  const id =
    statusIdFromHref(dom.getTimeLink(article)?.getAttribute('href')) || String(Date.now());
  return postFileName(handle, id, formatExtension(format));
}

/** Some browsers (Firefox) and insecure contexts cannot put an image on the clipboard. */
function canWriteClipboard() {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/** Visible post text, with line breaks kept for multi-paragraph posts. */
function postText(article) {
  const node = dom.getPostText(article);
  return String(node?.innerText || node?.textContent || '').trim();
}

/** Absolute permalink of the post, or `''` when the article has no status link. */
function postLink(article) {
  const href = dom.getTimeLink(article)?.getAttribute('href');
  if (!href) return '';
  try {
    return new URL(href, location.href).href;
  } catch {
    return '';
  }
}

async function copyImage(article) {
  if (canWriteClipboard()) {
    // The promise is handed over inside the click handler, so the render keeps
    // the user gesture that the clipboard API requires.
    const blobPromise = capturePost(article, { format: 'png' });
    // The rejection is handled below; this keeps it from surfacing as unhandled
    // while the clipboard write is in flight.
    blobPromise.catch(() => {});
    try {
      const item = new ClipboardItem({ 'image/png': blobPromise });
      await navigator.clipboard.write([item]);
      showToast(ss('copied'), { type: 'success' });
      return;
    } catch {
      /* denied or unsupported at runtime: fall through to the file */
    }
    const blob = await blobPromise;
    saveBlob(blob, fileName(article));
    showToast(ss('saved'), { type: 'warning' });
    return;
  }

  const blob = await capturePost(article, { format: 'png' });
  saveBlob(blob, fileName(article));
  showToast(ss('saved'), { type: 'warning' });
}

/**
 * Run a screenshot menu action.
 *
 * @param {Element} article
 * @param {Element} [btn]   button that shows the spinner
 * @param {'copy'|'save'|'preview'|'text'|'link'} action
 * @param {{ format?: 'png'|'jpeg' }} [options]
 */
export async function deliver(article, btn, action, { format = 'png' } = {}) {
  if (btn) {
    const busy = action === 'save' ? ss('saving') : action === 'preview' ? ss('previewing') : ss('copying');
    setButtonLabel(btn, busy, { loading: true });
  }
  try {
    if (action === 'text') {
      const text = postText(article);
      if (!text) {
        showToast(ss('textEmpty'), { type: 'warning', force: true });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast(ss('copiedText'), { type: 'success' });
      return;
    }

    if (action === 'link') {
      const link = postLink(article);
      if (!link) {
        showToast(ss('linkMissing'), { type: 'warning', force: true });
        return;
      }
      await navigator.clipboard.writeText(link);
      showToast(ss('copiedLink'), { type: 'success' });
      return;
    }

    if (action === 'save') {
      const blob = await capturePost(article, { format });
      saveBlob(blob, fileName(article, format));
      showToast(ss('downloaded'), { type: 'success' });
      return;
    }

    if (action === 'preview') {
      const blob = await capturePost(article, { format: 'png' });
      showPreview(article, blob);
      return;
    }

    await copyImage(article);
  } catch (error) {
    logWarn(Codes.SCREENSHOT_FAILED, 'post screenshot failed', { action, error });
    const captureAction = action === 'copy' || action === 'save' || action === 'preview';
    if (captureAction) {
      showToast(ss('captureFailed'), { type: 'error', force: true });
    } else {
      showToast(ss('copyFailed'), { type: 'error', force: true });
    }
  } finally {
    if (btn) setButtonLabel(btn, ss('button'), { glyph: 'camera' });
  }
}

/** One-click capture: copy to the clipboard, or save when the setting says so. */
export async function copyPost(article, btn) {
  return deliver(article, btn, cfg().save ? 'save' : 'copy', { format: 'png' });
}
