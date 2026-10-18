/**
 * i18n consistency check.
 *
 *  - every key used in src/ must exist in EVERY locale → errors, non-zero exit
 *    (English is the source of truth and the runtime fallback);
 *  - keys defined but never used are listed as warnings.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const NAMESPACES = [
  'panel', 'toast', 'general', 'about', 'backup', 'nav', 'menu', 'list', 'common',
  'translate', 'media', 'interface',
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'locales') continue;
      yield* walk(path);
    } else if (name.endsWith('.js')) {
      yield path;
    }
  }
}

async function loadLocales() {
  const dir = join(src, 'i18n', 'locales');
  const out = {};
  for (const name of readdirSync(dir)) {
    if (name === 'index.js' || !name.endsWith('.js')) continue;
    const mod = await import(pathToFileURL(join(dir, name)).href);
    out[name.replace(/\.js$/, '')] = mod.default;
  }
  return out;
}

function usedKeys(en) {
  const keys = new Set();
  const full = new RegExp(`['"\`]((?:${NAMESPACES.join('|')})(?:\\.[A-Za-z0-9-]+)+)['"\`]`, 'g');
  const scoped = [
    [/\btr\(\s*'([\w.]+)'/g, 'translate.'],
    [/\btm\(\s*'([\w.]+)'/g, 'media.'],
  ];
  for (const file of walk(src)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(full)) keys.add(match[1]);
    for (const [pattern, prefix] of scoped) {
      for (const match of text.matchAll(pattern)) keys.add(prefix + match[1]);
    }
    // Keys handed around as bare words (`runToggle(handle, fn, 'allowlistAdded')`) inside a
    // feature that scopes its keys with tr()/tm().
    for (const [folder, prefix] of [['translate', 'translate.'], ['media', 'media.']]) {
      if (!file.includes(`features${sep}${folder}${sep}`)) continue;
      for (const match of text.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)) {
        if (`${prefix}${match[1]}` in en) keys.add(`${prefix}${match[1]}`);
      }
    }
  }
  // tr()/tm() with a variable key are written as `translate.${…}` / `media.${…}`.
  for (const key of [...keys]) if (key.endsWith('.')) keys.delete(key);
  return keys;
}

/** Keys built from data at runtime (see the generators in the feature files). */
async function dynamicKeys() {
  const keys = new Set();
  for (const position of ['top-right', 'top-left', 'bottom-right', 'bottom-left']) {
    keys.add(`general.toastPosition.${position}`);
  }
  const rules = await import(pathToFileURL(join(src, 'features', 'interface', 'rules.js')).href);
  for (const path of ['menuLeft', 'sidebarRight', 'centerContent']) {
    keys.add(`interface.${path}`);
    keys.add(`interface.${path}Hint`);
  }
  for (const rule of rules.RULES) {
    keys.add(rules.ruleLabelKey(rule));
    if (rule.hint) keys.add(`${rules.ruleLabelKey(rule)}Hint`);
  }
  for (const level of ['success', 'info', 'warning', 'error']) keys.add(`toast.title.${level}`);
  return keys;
}

const locales = await loadLocales();
const used = new Set([...usedKeys(locales.en), ...(await dynamicKeys())]);
let errors = 0;

for (const locale of Object.keys(locales)) {
  const missing = [...used].filter((key) => !(key in locales[locale])).sort();
  if (missing.length) {
    errors += missing.length;
    console.error(`\n✖ "${locale}" is missing ${missing.length} used key(s):`);
    for (const key of missing) console.error(`    ${key}`);
  }
}

const unused = Object.keys(locales.en).filter((key) => !used.has(key)).sort();
if (unused.length) {
  console.warn(`\n! ${unused.length} English key(s) not referenced from code:`);
  for (const key of unused) console.warn(`    ${key}`);
}

console.log('\nLocale coverage (vs English):');
const total = Object.keys(locales.en).length;
for (const [locale, map] of Object.entries(locales)) {
  const have = Object.keys(locales.en).filter((key) => key in map).length;
  console.log(`  ${locale.padEnd(3)} ${String(have).padStart(4)} / ${total}  (${Math.round((have / total) * 100)}%)`);
}

if (errors) {
  console.error(`\ni18n check failed: ${errors} missing key(s).`);
  process.exit(1);
}
console.log('\ni18n check passed.');
