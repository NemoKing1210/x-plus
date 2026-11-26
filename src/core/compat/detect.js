/**
 * Generation detection.
 *
 * Probes are cheap `querySelector` checks supplied by each profile. Modern
 * wins when both generations match, because the new layout may keep a few
 * legacy test ids. A probe that throws must not hide the next profile.
 *
 * See docs/superpowers/specs/2026-11-26-dom-compatibility-design.md §6.3.
 *
 * @param {ParentNode} root
 * @param {Array<{ id: string, detect: (root: ParentNode) => boolean }>} profiles priority order
 * @returns {'modern'|'legacy'|'unknown'}
 */
export function detectGeneration(root = document, profiles = []) {
  for (const profile of profiles) {
    try {
      if (profile.detect(root)) return profile.id;
    } catch {
      /* a broken probe must not hide the next generation */
    }
  }
  return 'unknown';
}
