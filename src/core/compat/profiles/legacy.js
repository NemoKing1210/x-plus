/**
 * Legacy X DOM profile (`data-testid` markup).
 *
 * Task 4 onwards moves the current X-DOM knowledge from the feature modules
 * into `api`. Until then the stub only carries the detection probe.
 */

export default {
  id: 'legacy',

  detect(root) {
    return Boolean(
      root.querySelector('article[data-testid="tweet"]') ||
        root.querySelector('[data-testid="tweetText"]') ||
        root.querySelector('[data-testid="primaryColumn"]'),
    );
  },

  api: {},
  css: {},
};
