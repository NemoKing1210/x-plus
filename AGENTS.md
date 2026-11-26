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
- Docs: `README.md` (plus localized `README.<lang>.md` for every UI locale),
  `CHANGELOG.md` (Keep a Changelog + SemVer), `docs/ARCHITECTURE.md`,
  `docs/DEVELOPMENT.md`
- Task board: `TODO.md` (planned, in-progress and done work)
- License: MIT

## Architecture in one paragraph

A small **core** (`src/core/`: schema, feature registry, settings, bus, scan,
theme, storage, http, compat) runs independent **features** (`src/features/*`).
A feature calls `registerFeature({ id, fields, tabs, init, apply, scan,
navigate })`; its `fields` (declarative schema) define defaults, normalization
and the settings UI, `tabs` are rendered by the shared spec renderer. Full
details and the "add a feature / provider / rule" recipes:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tasks and TODO.md

`TODO.md` in the repository root is the single task board: planned work,
current work and recently finished work. It follows the
[todo.md spec](https://github.com/todomd/todo.md) — sections are board
columns, `- [ ]` is an open task, `- [x]` is done, and the completed column
is named with `✓`. Keep bug reports and feature discussion in GitHub Issues;
mirror anything you are about to act on into `TODO.md`.

**Working a task:**

1. **Pick and claim.** Take the top task from **Todo**, move it to
   **In Progress** (one task per person in progress) and add the owner handle
   and start date if they are missing.
2. **Read first.** Follow the links and read the relevant code, docs and tests.
   Restate the expected outcome in one sentence before changing anything; if
   you cannot, the task is underspecified — clarify it in `TODO.md` first.
3. **Plan before execution.** The task text is the starting plan; expand it
   into concrete steps, files to touch and verification to run before editing.
   For anything larger than a trivial one-file change (new feature, provider,
   clean-up rule, schema or UI change), get the plan agreed and keep it in the
   task or the PR description. Agents with a plan mode must use it.
4. **Implement in small, verified steps.** Stay within the task; split unrelated
   fixes into their own task and commit (see "Commits").
5. **Verify.** Run `npm run ci`, then the manual checks in
   [CONTRIBUTING.md](CONTRIBUTING.md#testing-checklist): harness at
   <http://localhost:5179/>, real `x.com`, all three themes and every locale.
6. **Close.** Move the task to **Done ✓** with the completion date
   (`yyyy-mm-dd`); add user-visible changes to `CHANGELOG.md` — under a new
   patch version for a `fix` or `perf` change, otherwise under
   `## [Unreleased]` (see [Releases](#releases)) —, update the READMEs and
   rebuild the root artifacts. Never delete a finished task — the Done column
   is the recent history.

**Writing tasks:** one outcome per task, imperative, with `~estimate`, a
`#scope` tag (the Conventional Commit scope, e.g. `#translate`, `#media`),
`@owner` and a date when known.

Write a task in as much detail as a short plan: context is lost between
sessions, so the next agent must be able to start from the task alone. A good
task covers:

- **Why** — the problem or user need, with a link to an issue, screenshot or
  spec when one exists.
- **Outcome** — what works when the task is done, including edge cases that
  must keep working (themes, locales, userscript managers).
- **Where** — the modules, selectors and docs expected to change, and the
  tests that cover them.
- **Steps** — the intended approach as ordered, two-space-indented
  checkboxes.
- **Done when** — the acceptance checks: `npm run ci`, the harness, real
  `x.com`, the relevant themes and locales.

If the approach is not clear yet, record the open questions instead of
guessing. Detail is not a work log: keep it about the plan and the result, not
about what you tried. `TODO.md` is a backlog, not a changelog.

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
- Features never contain X selectors: ask `dom` from `src/core/compat` and
  build CSS with `cssFor()`. X knowledge lives in the profiles
  (`src/core/compat/profiles/`); see "DOM generations" in
  `docs/DEVELOPMENT.md`. X ships a legacy and a modern build, so a rule whose
  target exists in one of them only carries `generations: { modern: false }`
  rather than a selector that silently matches nothing.
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

`README.md` is the English source; each UI locale has its own
`README.<lang>.md` with the same headings, code blocks and links. The badge
block and language switcher at the top of every README are generated — edit
`scripts/sync-readmes.mjs`, not the files, then run `npm run readmes`.
`npm run check:readmes` (part of `npm run ci`) enforces the structure.

## Releases

`version` moves with user-visible work, not with every edit:

- **A fix ships as a patch, with the change.** A `fix` or a `perf` change users
  can see bumps the patch (`0.16.0` → `0.16.1`) in `package.json` as part of
  that change, with its notes under `## [0.16.1] - yyyy-mm-dd` in
  `CHANGELOG.md`. Userscript managers only update when `@version` moves, so a
  fix left in `[Unreleased]` never reaches them. Run `npm run readmes` (the
  README badges carry the version) and rebuild the root artifacts.
- **A feature waits for a release.** Add new functionality to
  `## [Unreleased]`; it ships with the next minor (`0.17.0`) or major bump,
  made once per release. Docs, refactors, tests, build and CI edits do not move
  the version.

Release steps:

1. Set `version` in `package.json` for the content: a patch with a fix, a
   minor/major when cutting a feature release.
2. `npm run ci` (i18n check + build + artifact verification).
3. Add the `CHANGELOG.md` entry — notable user-facing changes only, one bullet
   per outcome, no work-log noise — and its comparison link at the bottom of
   the file.
4. Update `README.md` wherever the change is user-visible (`npm run readmes`
   refreshes the generated badges and language switcher), and
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
- Put an X selector in a feature: add it to a profile (or add a capability)
  and reach it through `dom` / `cssFor`.

## Local testing

```bash
npm install
npm run dev          # Vite serve — install the generated dev script (prefix "dev:")
npm run build        # production bundle → dist/ + copied to the repo root
npm run ci           # check:i18n + build + verify artifacts
npm run harness      # mock x.com page at http://localhost:5179 (run build first)
```
