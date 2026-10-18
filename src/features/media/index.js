import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { closeGallery, syncGallery } from './gallery.js';
import { upgradeFeedImages } from './feed-images.js';
import { mediaTabs } from './settings.js';
import { removeAllButtons, scanDownloadButtons } from './ui.js';
import { syncPhotoViewer } from './viewer.js';

/**
 * Media download: save videos, GIFs and photos from posts. Buttons appear in
 * the post's action bar and (optionally) over the media; sources, quality,
 * file naming and behaviour for multi-media posts are configurable.
 */
registerFeature({
  id: 'media',
  order: 20,

  fields: {
    enabled: field.bool(true),
    /** Button next to Share in the action bar. */
    showInActions: field.bool(true),
    /** Small button over each video / photo. */
    showOnMedia: field.bool(false),
    /** Which media kinds get download buttons. */
    videos: field.bool(true),
    gifs: field.bool(true),
    images: field.bool(true),
    /** `best`, `ask` (pick per download), a resolution cap, or `lowest`. */
    videoQuality: field.enum(['best', 'ask', '1080', '720', '480', 'lowest'], 'best'),
    imageQuality: field.enum(['orig', 'large'], 'orig'),
    /** Posts with several media: ask which to save, or save them all. */
    onMultiple: field.enum(['ask', 'all'], 'ask'),
    /** File name template; see FILENAME_TOKENS in filename.js. */
    fileTemplate: field.text('{user}-{id}-{n}', { max: 120 }),
    /** Upgrade photos in the timeline to a larger rendition. */
    feedImageQuality: field.enum(['default', 'large', 'orig'], 'default'),
    /** Wheel / drag / pinch zoom in the full-screen photo view. */
    photoZoom: field.bool(true),
    /** Grid pattern behind the photo in the full-screen view. */
    photoGrid: field.bool(true),
    /** Open post photos in our own gallery instead of X's photo page. */
    photoGallery: field.bool(false),
  },

  tabs: mediaTabs,

  apply(cfg) {
    if (!cfg.enabled) removeAllButtons();
    scanDownloadButtons();
    upgradeFeedImages();
    syncPhotoViewer();
    syncGallery();
  },

  scan() {
    scanDownloadButtons();
    upgradeFeedImages();
    syncPhotoViewer();
    syncGallery();
  },

  navigate() {
    closeGallery();
    syncPhotoViewer();
  },
});
