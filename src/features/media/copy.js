import { Codes, fail } from '../../core/debug.js';
import { gmRequest } from '../../core/http.js';

/**
 * Copy an image from the post to the clipboard.
 *
 * Browsers only accept `image/png` on the async clipboard, so JPEG / WebP
 * renditions are decoded and re-encoded through a canvas. The clipboard write
 * must start inside the click handler (transient user activation): `copyImage`
 * therefore calls `navigator.clipboard.write` synchronously and only hands it a
 * promise for the fetched and converted blob.
 */

/** Whether this browser can put an image on the clipboard at all. */
export function canCopyImages() {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    // Best effort: browsers that cannot encode PNG for the clipboard say so.
    (typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports('image/png'))
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(fail(Codes.MEDIA_COPY, 'could not decode image', { src }));
    image.src = src;
  });
}

/** Decode any image blob and encode it as PNG (the only type browsers paste). */
async function toPng(blob) {
  if (blob.type === 'image/png') return blob;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw fail(Codes.MEDIA_COPY, 'image has no size');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw fail(Codes.MEDIA_COPY, 'canvas is unavailable');
    context.drawImage(image, 0, 0);

    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw fail(Codes.MEDIA_COPY, 'png encoding returned no data');
    return png;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Put the image at `url` on the clipboard as PNG. Call it synchronously from a
 * click handler so the browser still sees the user gesture.
 *
 * @param {{ url: string, blob?: Blob, onProgress?: (ratio: number | null, loaded: number) => void }} options
 *   `blob` skips the fetch when the image is already in memory (screenshot preview).
 * @returns {Promise<number>} copied size in bytes
 */
export function copyImage({ url, blob, onProgress }) {
  if (!canCopyImages()) {
    return Promise.reject(fail(Codes.MEDIA_COPY, 'clipboard images unsupported', { url }));
  }

  let bytes = 0;
  let fetchError = null;
  const png = (async () => {
    let source = blob;
    if (!source) {
      try {
        source = await gmRequest({
          url,
          responseType: 'blob',
          anonymous: true,
          timeout: 15 * 60 * 1000,
          onProgress: ({ loaded, total }) => onProgress?.(total > 0 ? loaded / total : null, loaded),
        });
      } catch (error) {
        throw fail(Codes.MEDIA_COPY, 'copy request failed', { url }, error);
      }
    }
    if (!(source instanceof Blob) || source.size === 0) {
      throw fail(Codes.MEDIA_COPY, 'copy returned no data', { url });
    }
    const converted = await toPng(source);
    bytes = converted.size;
    return converted;
  })().catch((error) => {
    fetchError = error;
    throw error;
  });
  // Handled below; this keeps the rejection from surfacing as unhandled while
  // the clipboard write is in flight.
  png.catch(() => {});

  let writing;
  try {
    writing = navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (error) {
    return Promise.reject(fail(Codes.MEDIA_COPY, 'clipboard write failed', { url }, error));
  }
  return writing.then(
    () => bytes,
    (error) => {
      // The clipboard rejects with its own error; the fetch cause is more useful.
      throw fetchError || fail(Codes.MEDIA_COPY, 'clipboard write rejected', { url }, error);
    },
  );
}
