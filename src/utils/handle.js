/** Paths that are not user profiles on X/Twitter. */
const RESERVED_PATHS = new Set([
  'home',
  'explore',
  'search',
  'notifications',
  'messages',
  'settings',
  'i',
  'compose',
  'login',
  'logout',
  'signup',
  'tos',
  'privacy',
  'hashtag',
  'intent',
  'share',
  'following',
  'followers',
  'lists',
  'bookmarks',
  'communities',
  'premium',
  'jobs',
  'articles',
  'topics',
  'about',
  'download',
  'help',
  'display',
  'account',
]);

/** Normalize X/Twitter handles / profile paths to a bare lowercase handle. */
export function normalizeHandle(raw) {
  let value = String(raw || '')
    .replace(/ /g, ' ')
    .trim();
  if (!value) return '';

  value = value.replace(/^@+/, '');
  value = value.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '');
  value = value.replace(/^\//, '');
  value = value.split(/[/?#\s]/)[0] || '';
  value = value.replace(/^@+/, '').replace(/\/+$/, '');
  value = value.toLowerCase();

  if (!value || RESERVED_PATHS.has(value)) return '';
  if (!/^[a-z0-9_]{1,15}$/i.test(value)) return '';
  return value;
}

/** Extract a handle from an X profile/status href. */
export function handleFromHref(href) {
  if (!href) return '';
  let path = String(href).trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname;
    }
  } catch {
    /* keep path as-is */
  }
  path = path.replace(/^\//, '');
  const segment = path.split(/[/?#]/)[0] || '';
  return normalizeHandle(segment);
}

export function formatHandleDisplay(handle) {
  const h = normalizeHandle(handle);
  return h ? `@${h}` : '';
}
