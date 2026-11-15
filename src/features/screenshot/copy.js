import { Codes, logWarn } from '../../core/debug.js';
import { setButtonLabel } from '../../ui/action-button.js';
import { showToast } from '../../ui/toast.js';
import { saveBlob } from '../../utils/download.js';
import { handleFromHref } from '../../utils/handle.js';
import { capturePost } from './capture.js';
import { cfg, ss } from './config.js';
import { postFileName, statusIdFromHref } from './naming.js';

/** Post identity selectors (X-specific rules live at the top of the module). */
const USER_NAME = '[data-testid="User-Name"]';
const STATUS_LINK = 'a[href*="/status/"]';

function fileName(article) {
  const userLink = article.querySelector(`${USER_NAME} a[href^="/"]`);
  const handle = handleFromHref(userLink?.getAttribute('href')) || '';
  const statusLink = article.querySelector(STATUS_LINK);
  const id = statusIdFromHref(statusLink?.getAttribute('href')) || String(Date.now());
  return postFileName(handle, id);
}

/** Some browsers (Firefox) and insecure contexts cannot put an image on the clipboard. */
function canWriteClipboard() {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/** Capture one post and put it on the clipboard, falling back to a download. */
export async function copyPost(article, btn) {
  setButtonLabel(btn, ss('copying'), { loading: true });
  const blobPromise = capturePost(article);
  // The rejection is handled below; this keeps it from surfacing as unhandled
  // while the clipboard write is in flight.
  blobPromise.catch(() => {});

  try {
    if (cfg().save) {
      const blob = await blobPromise;
      saveBlob(blob, fileName(article));
      showToast(ss('downloaded'), { type: 'success' });
      return;
    }

    if (canWriteClipboard()) {
      try {
        // The promise is handed over inside the click handler, so the render
        // keeps the user gesture that the clipboard API requires.
        const item = new ClipboardItem({ 'image/png': blobPromise });
        await navigator.clipboard.write([item]);
        showToast(ss('copied'), { type: 'success' });
        return;
      } catch {
        /* denied or unsupported at runtime: fall through to the file */
      }
    }

    const blob = await blobPromise;
    saveBlob(blob, fileName(article));
    showToast(ss('saved'), { type: 'warning' });
  } catch (error) {
    logWarn(Codes.SCREENSHOT_FAILED, 'post screenshot failed', { error });
    showToast(ss('captureFailed'), { type: 'error' });
  } finally {
    setButtonLabel(btn, ss('button'), { glyph: 'camera' });
  }
}
