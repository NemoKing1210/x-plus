import { SEL } from '../../core/constants.js';
import { field } from '../../core/schema.js';

/**
 * Post appearance: cards, spacing, inner padding, text size and avatar shape.
 * Everything is plain CSS generated from the `postView` settings record, so
 * toggling an option only rewrites the stylesheet (see engine.js).
 */

export const CARD_STYLES = ['outline', 'filled', 'shadow'];
export const AVATAR_SHAPES = ['default', 'rounded', 'square'];

export const POST_VIEW_FIELDS = {
  cards: field.bool(false),
  cardStyle: field.enum(CARD_STYLES, 'outline'),
  cardRadius: field.int(16, { min: 0, max: 32 }),
  cardOpacity: field.int(100, { min: 0, max: 100 }),
  gap: field.int(0, { min: 0, max: 48 }),
  padding: field.int(0, { min: 0, max: 32 }),
  hideDividers: field.bool(false),
  hideFeedBorder: field.bool(false),
  textScale: field.int(100, { min: 80, max: 160 }),
  avatarShape: field.enum(AVATAR_SHAPES, 'default'),
};

/** Set on <html> while the settings dialog previews a draft: the live rules step aside. */
export const POSTS_PEEK_ATTR = 'data-xp-peek-posts';

const column = SEL.primaryColumn;
const cell = `${column} ${SEL.cell}`;
const article = `${cell} ${SEL.article}`;

const CARD_SURFACE = {
  outline: 'border:1px solid var(--xp-border)!important;box-shadow:none!important',
  filled: 'border:1px solid transparent!important;background-color:var(--xp-elevated)!important;box-shadow:none!important',
  shadow: 'border:1px solid transparent!important;background-color:var(--xp-surface)!important;box-shadow:var(--xp-shadow)!important',
};

const AVATAR_RADIUS = { rounded: '22%', square: '0' };

/**
 * Stylesheet for the given `postView` settings.
 * @param {typeof POST_VIEW_FIELDS extends infer F ? Record<keyof F, any> : never} cfg
 * @param {boolean} [peek] - previewing a draft: ignore the live rules instead of yielding to the preview
 */
export function postsCss(cfg, peek = false) {
  if (!cfg) return '';
  // The live stylesheet yields while a preview is running; the preview itself always applies.
  const scope = peek ? 'html' : `html:not([${POSTS_PEEK_ATTR}])`;
  const css = [];

  if (cfg.hideFeedBorder) {
    css.push(
      `${scope} ${column}{border-left-width:0!important;border-right-width:0!important}`,
      // X's empty 1px strip above the feed (atomic classes), which reads as a top border.
      `${scope} div.r-109y4c4.r-gu4em3:empty{display:none!important}`,
    );
  }

  if (cfg.cards) {
    css.push(
      `${scope} ${cell}{padding-left:8px!important;padding-right:8px!important}`,
      // Drop X's own separator line: the card border replaces it.
      `${scope} ${cell} > div,${scope} ${cell} > div > div{border-bottom-width:0!important}`,
      `${scope} ${article}{${CARD_SURFACE[cfg.cardStyle] || CARD_SURFACE.outline};border-radius:${cfg.cardRadius}px!important;overflow:hidden}`,
    );
    if (cfg.cardStyle === 'filled' && cfg.cardOpacity < 100) {
      css.push(
        `${scope} ${article}{background-color:color-mix(in srgb,var(--xp-elevated) ${cfg.cardOpacity}%,transparent)!important}`,
      );
    }
  } else if (cfg.hideDividers) {
    css.push(
      `${scope} ${cell} > div,${scope} ${cell} > div > div,${scope} ${article}{border-bottom-width:0!important}`,
    );
  }

  // Padding goes on the wrapper right around the post (inside the cell): X measures cell
  // heights, so the list stays consistent. The cell itself is a fixed-position slot.
  if (cfg.gap > 0) css.push(`${scope} ${cell} div:has(> ${SEL.article}){padding-top:${cfg.gap / 2}px!important;padding-bottom:${cfg.gap / 2}px!important;box-sizing:content-box!important}`);
  if (cfg.padding > 0) css.push(`${scope} ${article} > div{padding:${cfg.padding}px!important}`);
  if (cfg.textScale !== 100) {
    css.push(`${scope} ${article} ${SEL.tweetText}{zoom:${cfg.textScale / 100}}`);
  }
  if (AVATAR_RADIUS[cfg.avatarShape] != null) {
    css.push(
      `${scope} ${article} [data-testid^="UserAvatar-Container"],${scope} ${article} [data-testid^="UserAvatar-Container"] *{border-radius:${AVATAR_RADIUS[cfg.avatarShape]}!important}`,
    );
  }
  return css.join('\n');
}
