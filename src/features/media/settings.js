import { t } from '../../i18n/index.js';

/** Settings tab of the media download feature. */

export const mediaTabs = [
  {
    id: 'media',
    titleKey: 'media.title',
    badge: (draft) => (draft.media.enabled ? '' : t('common.off')),
    sections: [
      {
        titleKey: 'media.sectionViewer',
        descKey: 'media.sectionViewerDesc',
        controls: [
          { type: 'switch', path: 'photoZoom', labelKey: 'media.photoZoom', hintKey: 'media.photoZoomHint' },
          { type: 'switch', path: 'photoGrid', labelKey: 'media.photoGrid', hintKey: 'media.photoGridHint', showIf: (s) => s.photoZoom },
        ],
      },
      {
        titleKey: 'media.sectionMain',
        descKey: 'media.sectionMainDesc',
        controls: [
          { type: 'switch', path: 'enabled', labelKey: 'media.enabled', hintKey: 'media.enabledHint' },
        ],
      },
      {
        titleKey: 'media.sectionButtons',
        showIf: (s) => s.enabled,
        controls: [
          { type: 'switch', path: 'showInActions', labelKey: 'media.showInActions', hintKey: 'media.showInActionsHint' },
          { type: 'switch', path: 'showOnMedia', labelKey: 'media.showOnMedia', hintKey: 'media.showOnMediaHint' },
          { type: 'switch', path: 'videos', labelKey: 'media.videos' },
          { type: 'switch', path: 'gifs', labelKey: 'media.gifs' },
          { type: 'switch', path: 'images', labelKey: 'media.images' },
        ],
      },
      {
        titleKey: 'media.sectionQuality',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'select',
            path: 'videoQuality',
            labelKey: 'media.videoQuality',
            hintKey: 'media.videoQualityHint',
            options: [
              { value: 'best', labelKey: 'media.quality.best' },
              { value: 'ask', labelKey: 'media.quality.ask' },
              { value: '1080', labelKey: 'media.quality.1080' },
              { value: '720', labelKey: 'media.quality.720' },
              { value: '480', labelKey: 'media.quality.480' },
              { value: 'lowest', labelKey: 'media.quality.lowest' },
            ],
          },
          {
            type: 'select',
            path: 'imageQuality',
            labelKey: 'media.imageQuality',
            hintKey: 'media.imageQualityHint',
            options: [
              { value: 'orig', labelKey: 'media.image.orig' },
              { value: 'large', labelKey: 'media.image.large' },
            ],
          },
          {
            type: 'select',
            path: 'onMultiple',
            labelKey: 'media.onMultiple',
            hintKey: 'media.onMultipleHint',
            options: [
              { value: 'ask', labelKey: 'media.multiple.ask' },
              { value: 'all', labelKey: 'media.multiple.all' },
            ],
          },
        ],
      },
      {
        titleKey: 'media.sectionFiles',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'text',
            path: 'fileTemplate',
            labelKey: 'media.fileTemplate',
            hintKey: 'media.fileTemplateHint',
            placeholder: '{user}-{id}-{n}',
          },
          {
            type: 'hint',
            textKey: 'media.fileTokens',
          },
        ],
      },
      {
        titleKey: 'media.sectionFeed',
        showIf: (s) => s.enabled,
        controls: [
          {
            type: 'select',
            path: 'feedImageQuality',
            labelKey: 'media.feedImageQuality',
            hintKey: 'media.feedImageQualityHint',
            options: [
              { value: 'default', labelKey: 'media.feed.default' },
              { value: 'large', labelKey: 'media.feed.large' },
              { value: 'orig', labelKey: 'media.feed.orig' },
            ],
          },
        ],
      },
    ],
  },
];
