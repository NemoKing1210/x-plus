import { dom } from '../../core/compat/index.js';
import { openGalleryView } from '../media/gallery.js';
import { ss } from './config.js';
import { postFileName, statusIdFromHref } from './naming.js';

/**
 * Show a rendered post in the project's full-screen gallery, before anything is
 * copied or saved. The gallery supplies zoom, save and copy for the preview;
 * its actions work from the blob directly, without fetching a blob: URL.
 *
 * @param {Element} article
 * @param {Blob} blob
 */
export function showPreview(article, blob) {
  const handle = dom.getAuthorHandle(article) || '';
  const id =
    statusIdFromHref(dom.getTimeLink(article)?.getAttribute('href')) || String(Date.now());
  const url = URL.createObjectURL(blob);
  openGalleryView({
    slides: [
      {
        thumb: url,
        view: url,
        full: url,
        alt: ss('menuPreview'),
        blob,
        fileName: postFileName(handle, id, 'png'),
      },
    ],
    index: 0,
    label: ss('previewLabel'),
    onClose: () => URL.revokeObjectURL(url),
  });
}
