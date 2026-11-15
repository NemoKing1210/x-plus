/**
 * Localized README sync and check.
 *
 * Every README carries a generated header between the `<!-- xp:readme -->`
 * markers: the CI / install / license / version badges and the language
 * switcher. The header is derived from `package.json` and the locale list, so
 * the version badge and the links never drift between languages.
 *
 *   node scripts/sync-readmes.mjs           rewrite the header in every README
 *   node scripts/sync-readmes.mjs --check   verify only, non-zero exit on drift
 *
 * The check also compares every translation with the English README: the same
 * heading levels, code fences and link targets, plus the raw install URL.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const check = process.argv.includes('--check');

const START = '<!-- xp:readme -->';
const END = '<!-- /xp:readme -->';
const BASE = 'https://github.com/NemoKing1210/x-plus';
const BLOB = `${BASE}/blob/main`;
const RAW = 'https://raw.githubusercontent.com/NemoKing1210/x-plus/main';

const LOCALES = [
  {
    code: 'en',
    file: 'README.md',
    name: 'English',
    install: 'Install userscript',
    license: 'License: MIT',
    version: 'Version',
  },
  {
    code: 'ru',
    file: 'README.ru.md',
    name: 'Русский',
    install: 'Установить юзерскрипт',
    license: 'Лицензия: MIT',
    version: 'Версия',
  },
  {
    code: 'zh',
    file: 'README.zh.md',
    name: '中文',
    install: '安装用户脚本',
    license: '许可证：MIT',
    version: '版本',
  },
  {
    code: 'es',
    file: 'README.es.md',
    name: 'Español',
    install: 'Instalar userscript',
    license: 'Licencia: MIT',
    version: 'Versión',
  },
  {
    code: 'pt',
    file: 'README.pt.md',
    name: 'Português',
    install: 'Instalar userscript',
    license: 'Licença: MIT',
    version: 'Versão',
  },
  {
    code: 'de',
    file: 'README.de.md',
    name: 'Deutsch',
    install: 'Userscript installieren',
    license: 'Lizenz: MIT',
    version: 'Version',
  },
  {
    code: 'fr',
    file: 'README.fr.md',
    name: 'Français',
    install: 'Installer le userscript',
    license: 'Licence : MIT',
    version: 'Version',
  },
  {
    code: 'ja',
    file: 'README.ja.md',
    name: '日本語',
    install: 'ユーザースクリプトをインストール',
    license: 'ライセンス: MIT',
    version: 'バージョン',
  },
];

function generatedHeader(locale) {
  const badges = [
    `[![CI](${BASE}/actions/workflows/ci.yml/badge.svg)](${BASE}/actions/workflows/ci.yml)`,
    `[![${locale.install}](https://img.shields.io/badge/Install-userscript-0f1419?style=for-the-badge&labelColor=1d9bf0)](${RAW}/x-plus.user.js)`,
    `[![${locale.license}](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](${BLOB}/LICENSE)`,
    `[![${locale.version}](https://img.shields.io/badge/version-${pkg.version}-green?style=for-the-badge)](${BLOB}/CHANGELOG.md)`,
  ];
  const switcher = LOCALES.map((candidate) =>
    candidate === locale ? `**${candidate.name}**` : `[${candidate.name}](${BLOB}/${candidate.file})`,
  ).join(' · ');
  return `${START}\n${badges.join('\n')}\n\n${switcher}\n${END}`;
}

/** Heading levels outside fenced code blocks. */
function headingLevels(text) {
  const levels = [];
  let fence = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('```')) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = /^(#{1,6})\s+\S/.exec(line);
    if (match) levels.push(match[1].length);
  }
  return levels;
}

function fenceLines(text) {
  return text.split(/\r?\n/).filter((line) => line.startsWith('```')).length;
}

/** Markdown link targets, ignoring the generated language switcher. */
function linkTargets(text) {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !/README(?:\.[\w-]+)?\.md(?:#.*)?$/.test(target))
    .sort();
}

const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

const problems = [];
const report = (file, message) => problems.push(`${file}: ${message}`);

const files = new Map();
for (const locale of LOCALES) {
  const path = join(root, locale.file);
  if (!existsSync(path)) {
    report(locale.file, 'file is missing');
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  const markers = text.split(START).length - 1 + text.split(END).length - 1;
  if (start < 0 || end < start || markers !== 2) {
    report(locale.file, `expected exactly one ${START} … ${END} block`);
    continue;
  }
  const expected = generatedHeader(locale);
  const current = text.slice(start, end + END.length);
  const updated = text.slice(0, start) + expected + text.slice(end + END.length);
  if (current !== expected) {
    if (check) report(locale.file, 'generated header is out of date — run `npm run readmes`');
    else writeFileSync(path, updated);
  }
  files.set(locale.code, updated);
}

const reference = files.get('en');
if (reference) {
  const enHeadings = headingLevels(reference);
  const enFences = fenceLines(reference);
  const enLinks = linkTargets(reference);

  for (const locale of LOCALES) {
    const text = files.get(locale.code);
    if (!text || locale.code === 'en') continue;

    const firstLine = text.split(/\r?\n/).find((line) => line.trim());
    if (firstLine?.trim() !== '# X Plus') report(locale.file, 'must start with `# X Plus`');

    if (!text.includes(`${RAW}/x-plus.user.js`)) {
      report(locale.file, 'is missing the raw install URL');
    }

    const headings = headingLevels(text);
    if (!sameList(headings, enHeadings)) {
      report(
        locale.file,
        `headings differ from README.md (${headings.join(',')} vs ${enHeadings.join(',')})`,
      );
    }

    const fences = fenceLines(text);
    if (fences !== enFences) {
      report(locale.file, `has ${fences} code fence lines, README.md has ${enFences}`);
    }

    const links = linkTargets(text);
    if (!sameList(links, enLinks)) {
      const missing = enLinks.filter((target) => !links.includes(target));
      const extra = links.filter((target) => !enLinks.includes(target));
      const detail = [
        missing.length ? `missing: ${missing.join(', ')}` : '',
        extra.length ? `extra: ${extra.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      report(locale.file, `link targets differ from README.md — ${detail || 'different order'}`);
    }
  }
}

for (const [code, text] of files) {
  const file = LOCALES.find((locale) => locale.code === code).file;
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#|mailto:)/.test(target)) continue;
    const path = target.split('#')[0];
    if (path && !existsSync(join(root, path))) report(file, `link target does not exist: ${target}`);
  }
}

if (problems.length) {
  console.error(`\n✖ ${problems.length} README problem(s):`);
  for (const problem of problems) console.error(`    ${problem}`);
  process.exit(1);
}

console.log(check ? '\nREADME check passed.' : '\nREADMEs are in sync.');
