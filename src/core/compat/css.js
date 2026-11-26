/**
 * CSS fragments shared by profiles.
 *
 * CSS cannot call capability functions, so static and generated rules build
 * `:is(legacy, modern)` unions from these fragments. A modern fragment must not
 * also match legacy markup: the union then changes the legacy page instead of
 * covering a mixed one (a legacy `<main>` wraps both columns). The post
 * `article` is the same element in both builds, so that fragment is the one
 * intentional overlap.
 *
 * Never compose a fragment that itself contains `:has()` inside another
 * `:has()`: CSS forbids nesting, and the browser silently drops that branch.
 */

export function union(selectors) {
  const list = selectors.filter(Boolean);
  if (!list.length) return '';
  return list.length === 1 ? list[0] : `:is(${list.join(', ')})`;
}

export function combinedCss(profiles, key) {
  return union(profiles.map((profile) => profile.css?.[key]).filter(Boolean));
}
