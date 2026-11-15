import { Codes, fail } from '../../core/debug.js';
import { gmRequest } from '../../core/http.js';
import { saveBlob } from '../../utils/download.js';

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
