import { Codes, logError } from '../../core/debug.js';
import { icon } from '../../ui/icons.js';
import { openPopup } from '../../ui/popup.js';
import { showToast } from '../../ui/toast.js';
import { formatBitrate, formatBytes } from '../../utils/format.js';
import { resolveTweetMedia } from './api/index.js';
import { cfg, tm } from './config.js';
import { downloadFile } from './download.js';
import { buildFileName } from './filename.js';
import { getTweetId } from './tweet.js';
import { photoExtension, photoUrl, pickVariant, qualityLabel } from './variants.js';

/**
 * The download flow, shared by every entry point (action-bar button, overlay
 * buttons):
 *
 *   resolve media → filter by settings → build entries (one per file)
 *   → pick (popup) or download straight away → save with progress toast
 */

/** @typedef {{ item: import('./variants.js').MediaItem, n: number, url: string, ext: string, quality: string, bitrate?: string, label: string, hint: string }} Entry */

function isTypeEnabled(item, config) {
  if (item.type === 'video') return config.videos;
  if (item.type === 'gif') return config.gifs;
  return config.images;
}

function itemLabel(item, photoCount) {
  let base;
  if (item.type === 'photo') base = tm('item.photo', { n: item.index });
  else base = item.type === 'gif' ? tm('item.gif') : tm('item.video');
  if (item.type === 'photo' && photoCount[item.owner] <= 1) base = tm('item.photoSingle');
  return item.owner === 'quote' ? tm('item.quoted', { label: base }) : base;
}

/** One entry per downloadable file; `ask` mode lists every video quality. */
function buildEntries(items, config) {
  const photoCount = { main: 0, quote: 0 };
  for (const item of items) if (item.type === 'photo') photoCount[item.owner] += 1;

  const entries = [];
  let unsupported = 0;
  items.forEach((item, i) => {
    const n = i + 1;
    const label = itemLabel(item, photoCount);

    if (item.type === 'photo') {
      entries.push({
        item,
        n,
        url: photoUrl(item.url, config.imageQuality),
        ext: photoExtension(item.url),
        quality: config.imageQuality,
        label,
        hint: item.width ? `${item.width}×${item.height}` : '',
      });
      return;
    }

    const variants =
      config.videoQuality === 'ask'
        ? item.variants
        : [pickVariant(item.variants, config.videoQuality)].filter(Boolean);
    if (!variants.length) unsupported += 1;
    for (const variant of variants) {
      entries.push({
        item,
        n,
        url: variant.url,
        ext: 'mp4',
        quality: qualityLabel(variant),
        bitrate: formatBitrate(variant.bitrate),
        label,
        hint: [qualityLabel(variant), formatBitrate(variant.bitrate)].filter(Boolean).join(' · '),
      });
    }
  });
  return { entries, unsupported };
}

/** First (= best) entry of every media item. */
function bestPerItem(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.item)) return false;
    seen.add(entry.item);
    return true;
  });
}

function uniqueName(base, ext, used) {
  let name = `${base}.${ext}`;
  for (let i = 2; used.has(name); i += 1) name = `${base}-${i}.${ext}`;
  used.add(name);
  return name;
}

async function downloadEntries(entries, model, config) {
  const toast = showToast('', { title: tm('downloading'), duration: 0 });
  const used = new Set();
  let saved = 0;
  let failed = 0;
  let bytes = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const prefix = entries.length > 1 ? `${i + 1}/${entries.length} · ` : '';
    const base = buildFileName(config.fileTemplate, {
      user: entry.item.user || model.user,
      id: entry.item.tweetId || model.id,
      createdAt: model.createdAt,
      n: entry.n,
      quality: entry.quality,
      type: entry.item.type,
      text: model.text,
    });
    const fileName = uniqueName(base, entry.ext, used);

    toast.update({ message: `${prefix}${fileName}`, progress: 0 });
    try {
      bytes += await downloadFile({
        url: entry.url,
        fileName,
        onProgress: (ratio, loaded) => {
          const done = ratio == null ? 0 : ratio;
          toast.update({
            message: `${prefix}${fileName}${ratio == null ? ` · ${formatBytes(loaded)}` : ` · ${Math.round(done * 100)}%`}`,
            progress: (i + done) / entries.length,
          });
        },
      });
      saved += 1;
    } catch (error) {
      failed += 1;
      logError(Codes.MEDIA_DOWNLOAD, 'failed to download media', { entry, error });
    }
  }

  if (failed && !saved) {
    toast.dismiss();
    showToast(tm('failed'), { type: 'error', force: true });
  } else if (failed) {
    toast.update({
      type: 'warning',
      title: tm('partial'),
      message: tm('partialText', { saved, failed }),
      progress: 1,
      duration: 6000,
    });
  } else {
    toast.update({
      type: 'success',
      title: tm('saved'),
      message: tm('savedText', { count: saved, size: formatBytes(bytes) }),
      progress: 1,
      duration: 4000,
    });
  }
}

function showPicker(anchor, entries, model, config, multipleItems) {
  // One media item with several qualities: the quality is the headline.
  const items = entries.map((entry) => ({
    label: multipleItems ? entry.label : entry.quality || entry.label,
    hint: multipleItems ? entry.hint : entry.bitrate || entry.hint,
    iconHtml: icon(entry.item.type === 'photo' ? 'image' : 'video'),
    onSelect: () => downloadEntries([entry], model, config),
  }));

  if (multipleItems) {
    items.unshift(
      {
        label: tm('downloadAll'),
        iconHtml: icon('download'),
        onSelect: () => downloadEntries(bestPerItem(entries), model, config),
      },
      { separator: true },
    );
  }

  openPopup({
    anchor,
    title: model.user ? `@${model.user}` : tm('download'),
    items,
  });
}

/**
 * Run the download flow for one post.
 *
 * @param {object} options
 * @param {Element} options.article
 * @param {Element} options.anchor            - element the picker anchors to
 * @param {(item: import('./variants.js').MediaItem) => boolean} [options.filter] - narrow to one media element
 * @param {(busy: boolean) => void} [options.setBusy]
 */
export async function startDownload({ article, anchor, filter, setBusy }) {
  const id = getTweetId(article);
  if (!id) {
    showToast(tm('noId'), { type: 'error', force: true });
    return;
  }

  const config = cfg();
  setBusy?.(true);
  try {
    const model = await resolveTweetMedia(id);
    const items = model.items.filter((item) => isTypeEnabled(item, config) && (filter ? filter(item) : true));
    if (!items.length) {
      showToast(tm('noMedia'), { type: 'warning', force: true });
      return;
    }

    const { entries, unsupported } = buildEntries(items, config);
    if (!entries.length) {
      showToast(unsupported ? tm('noVariants') : tm('noMedia'), { type: 'warning', force: true });
      return;
    }

    const multipleItems = new Set(entries.map((e) => e.item)).size > 1;
    const askQuality = config.videoQuality === 'ask' && entries.length > new Set(entries.map((e) => e.item)).size;
    const askMultiple = multipleItems && config.onMultiple === 'ask';

    if (askQuality || askMultiple) {
      showPicker(anchor, entries, model, config, multipleItems);
    } else {
      await downloadEntries(entries, model, config);
    }
  } catch (error) {
    logError(Codes.MEDIA_RESOLVE, 'media download failed', { error });
    const signedOut = error?.cause?.code === 'auth' || error?.code === 'auth';
    showToast(signedOut ? tm('needLogin') : tm('resolveFailed'), { type: 'error', force: true });
  } finally {
    setBusy?.(false);
  }
}
