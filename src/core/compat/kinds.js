/**
 * Capability kinds. A kind decides how the resolver treats an empty answer
 * from a profile: list kinds union, single kinds take the first answer, and
 * predicates are boolean.
 *
 * Keep this table in sync with `DOM compatibility` in docs/ARCHITECTURE.md
 * and with the profile API in profiles/legacy.js and profiles/modern.js.
 */

export const KINDS = Object.freeze({
  // page-list: union across profiles, then dedupe.
  getArticles: 'page-list',
  getTextRoots: 'page-list',
  getMenus: 'page-list',
  getFeedTabs: 'page-list',
  getPostCells: 'page-list',
  getUserCells: 'page-list',
  getViewerImages: 'page-list',
  getOverlayRoots: 'page-list',

  // page-single: active profile first, then the others; first non-empty.
  getNav: 'page-single',
  getNavItem: 'page-single',
  getSidebar: 'page-single',
  getComposer: 'page-single',
  getInlineComposer: 'page-single',
  getArticleBody: 'page-single',
  getArticleTitle: 'page-single',
  getViewerLayer: 'page-single',
  getPrimaryColumn: 'page-single',
  getSidebarColumn: 'page-single',
  getLeftNav: 'page-single',

  // element-single: the owner profile is authoritative.
  getPostText: 'element-single',
  getAuthorHeader: 'element-single',
  getAuthorHeaders: 'element-list',
  getAuthorName: 'element-single',
  getAuthorHandle: 'element-single',
  getAuthorAvatar: 'element-single',
  getTimeLink: 'element-single',
  getHeaderActionsSlot: 'element-single',
  getGrokButton: 'element-single',
  getActionGroup: 'element-single',
  getQuoteCard: 'element-single',
  getPostMenuTrigger: 'element-single',
  getMenuItemHost: 'element-single',
  getSidebarBlock: 'element-single',
  getSidebarCard: 'element-single',
  getViewerStage: 'element-single',
  getAvatarColumn: 'element-single',
  getVerifiedBadge: 'element-single',
  getSocialContext: 'element-single',
  getNativeTranslateBar: 'element-single',
  getFeedTabsBlock: 'element-single',
  getPostCell: 'element-single',
  getPostArticle: 'element-single',
  getNavTemplate: 'element-single',

  // element-list: the owner profile answers; no cross-profile union.
  getMediaHosts: 'element-list',
  getAttachments: 'element-list',
  getThreadLineCandidates: 'element-list',

  // predicate: the owner profile answers; false is final.
  isOwnText: 'predicate',
  isMenuOpen: 'predicate',
  isPromotedArticle: 'predicate',
  hasNativeAutoTranslate: 'predicate',
});

/**
 * @param {string} key capability name
 * @returns {'page-list'|'page-single'|'element-single'|'element-list'|'predicate'}
 */
export function kindOf(key) {
  const kind = KINDS[key];
  if (!kind) throw new Error(`unknown capability: ${key}`);
  return kind;
}
