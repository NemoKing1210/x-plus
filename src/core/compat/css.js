/**
 * CSS fragments shared by profiles.
 *
 * CSS cannot call capability functions, so static and generated rules build
 * `:is(legacy, modern)` unions from these fragments. The legacy selector is a
 * subset of the modern one in most cases, which keeps the union safe on mixed
 * A/B pages.
 */

export function union(selectors) {
  const list = selectors.filter(Boolean);
  if (!list.length) return '';
  return list.length === 1 ? list[0] : `:is(${list.join(', ')})`;
}

export function combinedCss(profiles, key) {
  return union(profiles.map((profile) => profile.css?.[key]).filter(Boolean));
}
