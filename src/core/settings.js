import { SETTINGS_KEY } from './constants.js';
import { emit } from './bus.js';
import { Codes, logError } from './debug.js';
import { getFeatures } from './features.js';
import { defaultsOf, normalizeFields } from './schema.js';
import { getValue, setValue } from './storage.js';

/**
 * Single source of truth for user settings.
 *
 * The settings object is `{ [featureId]: featureSettings }`; every feature
 * contributes its own schema via the registry. Settings are normalized on
 * load, save and import, persisted to GM storage and announced on the bus.
 */

/** @type {Record<string, any> | null} */
let settings = null;

function featureFields() {
  const map = {};
  for (const feature of getFeatures()) {
    // Features without settings (e.g. the settings UI itself) own no section.
    if (Object.keys(feature.fields).length) map[feature.id] = feature.fields;
  }
  return map;
}

/** Fresh defaults for every registered feature. */
export function getDefaults() {
  const out = {};
  for (const [id, fields] of Object.entries(featureFields())) out[id] = defaultsOf(fields);
  return out;
}

/** Normalize a raw (stored / imported / edited) settings blob. */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [id, fields] of Object.entries(featureFields())) {
    out[id] = normalizeFields(fields, source[id]);
  }
  return out;
}

export function loadSettings() {
  settings = normalizeSettings(getValue(SETTINGS_KEY, null));
  return settings;
}

export function getSettings() {
  return settings || loadSettings();
}

export function getFeatureSettings(id) {
  return getSettings()[id];
}

function persist() {
  if (!setValue(SETTINGS_KEY, settings)) {
    logError(Codes.SETTINGS_PERSIST, 'failed to persist settings');
  }
}

function announce(prev, next) {
  for (const id of Object.keys(next)) {
    if (JSON.stringify(prev?.[id]) !== JSON.stringify(next[id])) {
      emit(`settings:${id}`, next[id], prev?.[id] ?? null);
    }
  }
  emit('settings:changed', { prev, next });
}

/** Replace all settings with a normalized copy of `next`, persist, announce. */
export function saveSettings(next) {
  const prev = getSettings();
  settings = normalizeSettings(next);
  persist();
  announce(prev, settings);
  return settings;
}

/** Shallow-merge a patch into one feature's section (used by in-page actions). */
export function updateFeatureSettings(id, patch) {
  const current = getSettings();
  return saveSettings({ ...current, [id]: { ...current[id], ...patch } });
}

/** Settings as pretty JSON for backups. */
export function exportSettings() {
  return JSON.stringify(getSettings(), null, 2);
}

/**
 * Import a JSON backup. Unknown keys are dropped, invalid values fall back to
 * defaults. Throws on malformed JSON.
 */
export function importSettings(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    logError(Codes.SETTINGS_IMPORT, 'backup is not valid JSON', { error });
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup must be a JSON object');
  }
  return saveSettings(parsed);
}
