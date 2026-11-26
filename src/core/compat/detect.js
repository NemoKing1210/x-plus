import { Codes, logWarn } from '../debug.js';

/**
 * Generation detection.
 *
 * Probes are cheap `querySelector` checks supplied by each profile. Modern
 * wins when both generations match, because the new layout may keep a few
 * legacy test ids. A probe that throws must not hide the next profile.
 *
 * See `DOM generations` in docs/DEVELOPMENT.md.
 *
 * @param {ParentNode} root
 * @param {Array<{ id: string, detect: (root: ParentNode) => boolean }>} profiles priority order
 * @returns {'modern'|'legacy'|'unknown'}
 */
export function detectGeneration(root = document, profiles = []) {
  for (const profile of profiles) {
    try {
      if (profile.detect(root)) return profile.id;
    } catch (error) {
      // A broken probe must not hide the next generation, but it is still a
      // profile failure: report it with the same code as a capability throw.
      logWarn(Codes.COMPAT_PROFILE, `${profile.id} probe failed`, error);
    }
  }
  return 'unknown';
}
