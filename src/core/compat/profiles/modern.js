/**
 * Modern X DOM profile (2026 Tailwind + `xds` markup).
 *
 * Task 10 onwards fills `api`; the stub only carries the detection probe.
 */

export default {
  id: 'modern',

  detect(root) {
    return Boolean(
      root.querySelector('[data-engagement-action]') ||
        root.querySelector('[data-slot^="xds-"]') ||
        root.querySelector('header[data-page-header]') ||
        root.querySelector('div[id^="urt:"]'),
    );
  },

  api: {},
  css: {},
};
