import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';

export const cfg = () => getFeatureSettings('media');
/** Media-scoped `t()`. */
export const tm = (key, vars) => t(`media.${key}`, vars);

export const ATTR = Object.freeze({
  article: 'data-xp-media',
  action: 'data-xp-media-action',
  overlay: 'data-xp-media-overlay',
  host: 'data-xp-media-host',
  feedImage: 'data-xp-img',
});
