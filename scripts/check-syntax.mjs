/**
 * Dependency-free syntax check for every source module.
 *
 * Node parses each file with the package's module type (`"type": "module"`),
 * so a stray bracket, an unclosed template or a bad import/export fails here
 * before the bundle is built. (A full type check would need TypeScript.)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [join(root, 'src'), join(root, 'scripts'), join(root, 'test')];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (name.endsWith('.js') || name.endsWith('.mjs')) {
      yield path;
    }
  }
}

let failures = 0;
let checked = 0;
for (const dir of roots) {
  for (const file of walk(dir)) {
    checked += 1;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      failures += 1;
      console.error(`✖ ${relative(root, file)}\n${result.stderr.trim()}`);
    }
  }
}

if (failures) {
  console.error(`\n${failures} of ${checked} files failed to parse.`);
  process.exit(1);
}
console.log(`✓ ${checked} files parse cleanly.`);
