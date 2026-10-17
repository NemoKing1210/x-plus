import { Codes, fail } from '../../core/debug.js';
import { gmRequest } from '../../core/http.js';

/** Hand a Blob to the browser as a file download. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to start reading the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Download `url` through the userscript manager (cross-origin, no CORS
 * limits, with progress) and save it as `fileName`.
 *
 * @param {{ url: string, fileName: string, onProgress?: (ratio: number | null, loaded: number) => void }} options
 * @returns {Promise<number>} saved size in bytes
 */
export async function downloadFile({ url, fileName, onProgress }) {
  let blob;
  try {
    blob = await gmRequest({
      url,
      responseType: 'blob',
      anonymous: true,
      timeout: 15 * 60 * 1000,
      onProgress: ({ loaded, total }) => onProgress?.(total > 0 ? loaded / total : null, loaded),
    });
  } catch (error) {
    throw fail(Codes.MEDIA_DOWNLOAD, 'download request failed', { url }, error);
  }
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw fail(Codes.MEDIA_DOWNLOAD, 'download returned no data', { url });
  }
  saveBlob(blob, fileName);
  return blob.size;
}
