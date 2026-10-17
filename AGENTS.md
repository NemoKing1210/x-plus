# AGENTS.md — X Plus

Instructions for AI coding agents working in this repository.

## Project

Userscript for [X](https://x.com) (x.com / twitter.com): in-place post
translation (a port of the sibling `x-translator` project), media download
(videos, GIFs, photos) and interface clean-up, behind one settings panel.
Built with Vite + `vite-plugin-monkey` for Tampermonkey, Violentmonkey,
ScriptCat and compatible managers. The sibling `steam-plus` project is the
reference for architecture and conventions.

- Source entry point: `src/main.js`
- Version source of truth: `package.json`
- Generated install artifacts (committed): `x-plus.user.js`, `x-plus.meta.js`
  — produced only by `npm run build`; never hand-edit them
- Docs: `README.md`, `CHANGELOG.md` (Keep a Changelog + SemVer),
  `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`
- License: MIT

## Architecture in one paragraph

A small **core** (`src/core/`: schema, feature registry, settings, bus, scan,
theme, storage, http) runs independent **features** (`src/features/*`). A
feature calls `registerFeature({ id, fields, tabs, init, apply, scan,
navigate })`; its `fields` (declarative schema) define defaults, normalization
and the settings UI, `tabs` are rendered by the shared spec renderer. Full
details and the "add a feature / provider / rule" recipes:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Conventions

- Vanilla ES modules, no frameworks, no TypeScript. GM APIs come from `$`
  (`vite-plugin-monkey/dist/client`).
- Prefix DOM / storage keys with `xp-` / `data-xp-` / `xp_`. Create UI through
  `el()` (it tags elements with `data-xp-ui`, which scans ignore).
- Settings live in the schema (`core/schema.js`); never read or write
  `GM_getValue` directly — use `getFeatureSettings` / `updateFeatureSettings` /
  `saveSettings`.
- Features react to settings through `apply(cfg, prev)` and to the page
  through `scan(root)`; keep both **idempotent** (they run often).
- Every X-specific selector lives in `src/core/constants.js` (`SEL`) or at the
  top of the module that needs it (see "Verifying X selectors" in
  `docs/DEVELOPMENT.md`). X's DOM changes often: prefer `data-testid`.
- Do not expand `@connect` / `@grant` beyond what is needed; metadata lives in
  `vite.config.js`, not in built files. Never commit localhost
  `@updateURL` / `@downloadURL`.
- Colors come from `src/styles/tokens.css` (`var(--xp-*)`); UI must work in
  X's light, dim and lights-out themes.
- Errors use stable codes from `core/debug.js` (`XP-####`); user-visible
  problems also get a toast.
- Do not break X's native navigation, composer or infinite scroll, and do not
  imply affiliation with X Corp.

## Localization

Locales: `en`, `ru`, `zh`, `es`, `pt`, `de`, `fr`, `ja` (plus `auto` = browser).
Keys are flat `namespace.key` strings. Add every new user-facing string to
**all** locale files; `npm run check:i18n` fails on a missing key and lists
unused ones. Keep localized `@name` / `@description` in `vite.config.js`
aligned with the product description.

## Releases

1. Bump `version` in `package.json` **once per release**, not per edit.
2. `npm run ci` (i18n check + build + artifact verification).
3. Add / update the `CHANGELOG.md` entry — notable user-facing changes only,
   one bullet per outcome, no work-log noise.
4. Update `README.md` wherever the change is user-visible, and
   `docs/ARCHITECTURE.md` when structure changes.

## Commits

- Commit only when asked. Never add yourself as a co-author: no
  `Co-Authored-By` trailer and no "Generated with …" line in commit messages
  or PR descriptions (explicit owner request).
- Follow commitlint rules (`@commitlint/config-conventional`, Conventional
  Commits): `type(scope): subject`, where `type` is one of `feat`, `fix`,
  `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
  `revert`; optional lowercase `scope` (e.g. `translate`, `settings`, `media`,
  `i18n`); imperative subject in lower case, no trailing period, header up to
  100 characters; blank line before the body and footer, body lines up to 100
  characters. Breaking changes: `!` after the type/scope or a
  `BREAKING CHANGE:` footer.
- Write the message from the actual diff (`git status` / `git diff --stat`
  first). It must describe everything that is staged, including changes you
  did not make yourself; split unrelated changes into separate commits.
- Rebuild (`npm run build`) before committing source changes so the committed
  `x-plus.user.js` / `x-plus.meta.js` match `src/`.

## Do not

- Hand-edit `x-plus.user.js` / `x-plus.meta.js`.
- Add a frontend framework or TypeScript unless explicitly requested.
- Bypass the schema (unvalidated settings) or create UI outside `el()`.

## Local testing

```bash
npm install
npm run dev          # Vite serve — install the generated dev script (prefix "dev:")
npm run build        # production bundle → dist/ + copied to the repo root
npm run ci           # check:i18n + build + verify artifacts
npm run harness      # mock x.com page at http://localhost:5179 (run build first)
```
