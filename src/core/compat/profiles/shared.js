/**
 * Helpers shared by both DOM profiles.
 */

/** Marks the root of every element we inject; profiles never scan inside it. */
export const UI_ATTR = 'data-xp-ui';

export const OVERLAY_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[aria-modal="true"]',
  '.xp-gallery',
  '.xp-popup',
  '.xp-settings-backdrop',
  '.xp-confirm-overlay',
].join(', ');

export function normalizeHandleText(text = '') {
  return text.trim().replace(/^@/, '').toLowerCase();
}

export function overlayRoots(root) {
  return [...root.querySelectorAll(OVERLAY_SELECTOR)];
}

/** Labels X uses for promoted posts, lower-case (the ones we know of). */
export const AD_LABELS = new Set([
  'ad',
  'promoted',
  'реклама',
  'anzeige',
  'anuncio',
  'annonce',
  'publicité',
  'publicidade',
  'pubblicità',
  'promowane',
  'reklama',
  'reklam',
  '広告',
  '广告',
  '廣告',
  '광고',
]);

/** Path prefix of the "Ad" rectangle glyph X draws next to promoted posts. */
export const AD_ICON_PATH_PREFIX = 'M19.498 3h-15c-1.381';

/** Font weight of a navigation row's label: 700 means the row is the active route. */
export function navLabelWeight(node) {
  const label = node?.querySelector?.('div[dir]');
  if (!label) return null;
  const raw = getComputedStyle(label).fontWeight;
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  if (raw === 'bold') return 700;
  if (raw === 'normal') return 400;
  return null;
}

/**
 * Whether the left-menu hover pill is a class. The legacy build adds an
 * `r-*` class to the inner pill from JS on hover (so our cloned row has to
 * mirror it, and the class name is worth learning from X's own rows); the
 * modern build styles the row with CSS and needs neither.
 *
 * @param {string} generation - 'legacy' | 'modern' | 'unknown'
 * @returns {boolean}
 */
export function navUsesHoverClass(generation) {
  return generation !== 'modern';
}

/** Aria-labels for X's Show original / about-auto-translate (locale fallback). */
export const NATIVE_AUTO_TRANSLATE_LABEL_RE =
  /^(show original|показать оригинал|mostrar (el )?original|afficher l['’]original|original anzeigen|mostra (l['’])?originale|オリジナルを表示|显示原文|顯示原文|mostrar original|about automatic translation|об автоматическом переводе|acerca de la traducci[oó]n autom[aá]tica|à propos de la traduction automatique|informationen zur automatischen [üu]bersetzung|informazioni sulla traduzione automatica|自動翻訳について|关于自动翻译|關於自動翻譯|sobre a tradu[cç][aã]o autom[aá]tica)$/i;
