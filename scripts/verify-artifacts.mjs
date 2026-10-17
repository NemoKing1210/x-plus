import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACT_FILES } from './lib/artifacts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function hash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

for (const name of ARTIFACT_FILES) {
  const built = join(dist, name);
  const install = join(root, name);
  if (!existsSync(built) || !existsSync(install)) {
    console.error(`verify-artifacts: missing ${name}; run npm run build`);
    process.exit(1);
  }
  if (hash(built) !== hash(install)) {
    console.error(`verify-artifacts: ${name} differs from dist/${name}`);
    process.exit(1);
  }
  console.log(`ok  dist ↔ root  ${name}`);
}
