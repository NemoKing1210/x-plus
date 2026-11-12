import './styles/tokens.css';
import './styles/base.css';
import './styles/translate.css';
import './styles/media.css';
import './styles/gallery.css';
import './styles/shorts.css';
import './styles/settings.css';
import './styles/filter.css';
import './styles/motion.css';

import { emit, on } from './core/bus.js';
import { ROOT_ATTR } from './core/constants.js';
import { getFeatures, runFeatureHook, runHook } from './core/features.js';
import { startNavigationWatch, startScanning, scanNow } from './core/scan.js';
import { getFeatureSettings, loadSettings } from './core/settings.js';
import { observePageTheme } from './core/theme.js';
import { applyRuleStyles } from './features/interface/engine.js';
import { runBootIntro, startBootVeil } from './ui/boot.js';
import { whenReady } from './utils/dom.js';

/*
 * Feature modules register themselves on import (core/features.js). Order of
 * these imports does not matter: execution order follows each feature's
 * `order`. To add a feature, create features/<name>/index.js and import it here.
 */
import './features/general/index.js';
import './features/translate/index.js';
import './features/media/index.js';
import './features/shorts/index.js';
import './features/interface/index.js';
import './features/filter/index.js';
import './features/settings/index.js';

function boot() {
  const root = document.documentElement;
  if (root.hasAttribute(ROOT_ATTR)) return;
  root.setAttribute(ROOT_ATTR, '1');

  loadSettings();
  observePageTheme(() => emit('theme'));

  // Everything that injects or reshapes the page runs under the boot veil, so
  // the first applied state is revealed as a transition instead of a snap.
  runBootIntro(applyFeatures);
}

function applyFeatures() {
  // Feature by feature: one-time init, then the initial apply. `general`
  // (order 0) therefore configures the UI language before anything renders.
  for (const feature of getFeatures()) {
    runFeatureHook(feature.id, 'init');
    runFeatureHook(feature.id, 'apply', getFeatureSettings(feature.id), null);
    on(`settings:${feature.id}`, (cfg, prev) => runFeatureHook(feature.id, 'apply', cfg, prev));
  }

  on('scan', (scanRoot) => runHook('scan', scanRoot));
  on('navigate', (url) => runHook('navigate', url));

  // The interface language is applied by `general` first; re-run the scans so
  // button / menu labels in the already-rendered chrome switch language too.
  on('settings:general', (cfg, prev) => {
    if (prev && prev.language !== cfg.language) scanNow();
  });

  startScanning();
  startNavigationWatch();
  scanNow();
}

// The script runs at document-start: put the boot veil up before X's first
// paint, inject the declarative "hide" CSS, then boot the rest of the UI once
// the DOM is ready (the veil lifts when the applied page is ready).
startBootVeil();
loadSettings();
if (document.documentElement) applyRuleStyles();

whenReady(boot);
