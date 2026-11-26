/**
 * Public compatibility API.
 *
 * Features import `dom` and call capabilities; they never contain X
 * selectors. This module owns the singleton resolver, the generation
 * attributes on `<html>` and the debug report.
 *
 * See `DOM compatibility` in docs/ARCHITECTURE.md.
 */

import { Codes, isVerbose, logError, logInfo, logWarn } from '../debug.js';
import { combinedCss } from './css.js';
import { detectGeneration } from './detect.js';
import { KINDS } from './kinds.js';
import { createReport } from './report.js';
import { createResolver } from './resolve.js';
import legacy from './profiles/legacy.js';
import modern from './profiles/modern.js';

const PROFILES = [modern, legacy];
const report = createReport();
let missesSinceDetect = 0;
let redetected = false;

const resolver = createResolver({
  profiles: PROFILES,
  report,
  logger: {
    miss: (key) => {
      logInfo('compat', `${Codes.COMPAT_MISS} no profile answered ${key}`);
      missesSinceDetect += 1;
      if (!redetected && missesSinceDetect >= 5 && !forcedProfile()) {
        redetected = true;
        const run = () => refreshCompat();
        if (typeof queueMicrotask === 'function') queueMicrotask(run);
        else setTimeout(run, 0);
      }
    },
    fallback: (profileId, key) => logInfo('compat', `${Codes.COMPAT_FALLBACK} fallback ${key} -> ${profileId}`),
    error: (profileId, key, error) => logError(Codes.COMPAT_PROFILE, `${profileId}.${key}`, error),
  },
});

/** Every capability as a function, derived from the kind table. */
export const dom = Object.fromEntries(
  Object.keys(KINDS).map((key) => [key, (...args) => resolver.resolve(key, args)]),
);

export function cssFor(key) {
  return combinedCss(PROFILES, key);
}

function forcedProfile() {
  if (typeof window === 'undefined') return null;
  const forced = window.__XP_FORCE_DOM__;
  return PROFILES.some((profile) => profile.id === forced) ? forced : null;
}

function applyGeneration(root, { reset = false } = {}) {
  const html = root.documentElement || root;
  const forced = forcedProfile();
  const generation = forced || detectGeneration(root, PROFILES);
  const active = forced || (generation === 'unknown' ? resolver.activeId() || 'modern' : generation);

  resolver.setActive(active);
  report.active = active;
  report.generation = generation;
  report.xBuild = html.getAttribute?.('data-app-version') || '';

  html.setAttribute?.('data-xp-dom', generation);
  html.setAttribute?.('data-xp-dom-build', report.xBuild);
  if (forced) html.setAttribute?.('data-xp-dom-force', forced);

  if (reset) {
    resolver.clearOwners();
    report.resetForNavigation();
    missesSinceDetect = 0;
    redetected = false;
  }

  return generation;
}

export function initCompat(root = document) {
  const generation = applyGeneration(root);
  const readyState = root.readyState || root.ownerDocument?.readyState;
  if (generation === 'unknown' && readyState !== 'loading') {
    logWarn(Codes.COMPAT_GENERATION, 'X DOM generation not recognized yet');
  }
  if (isVerbose() && typeof window !== 'undefined') {
    window.__xpCompat = {
      dom,
      report: compatReport,
      refresh: refreshCompat,
      generation: getGeneration,
    };
  }
  logInfo('compat', `generation=${generation}`, report.snapshot());
}

export function refreshCompat(root = document, { navigation = false } = {}) {
  return applyGeneration(root, { reset: navigation });
}

export function getGeneration() {
  return report.generation;
}

export function compatReport() {
  return report.snapshot();
}

/**
 * Build-time helpers for the parts of the page no capability covers.
 * Re-exported here so features depend on the public API only.
 */
export { navLabelWeight, navUsesHoverClass } from './profiles/shared.js';
