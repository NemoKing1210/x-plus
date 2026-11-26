# Contributing to X Plus

Thanks for your interest in improving X Plus. It is a vanilla-JavaScript
userscript built with Vite — small, dependency-light and easy to test locally.

## Ways to help

- Report bugs and suggest features via
  [GitHub Issues](https://github.com/NemoKing1210/x-plus/issues).
- Open pull requests for fixes, features, docs or translations.
- Test on different userscript managers (Tampermonkey, Violentmonkey,
  ScriptCat), browsers and X themes (light, dim, lights-out).
- Report broken selectors after X UI updates — screenshots and `data-testid`
  hints help a lot.

## Before you start

1. Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup, scripts and the
   release checklist.
2. Skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the feature/core split
   and the “add a feature / provider / rule” recipes.
3. Read [AGENTS.md](AGENTS.md) for conventions shared by human and AI
   contributors.
4. Check [README.md](README.md), [CHANGELOG.md](CHANGELOG.md) and the open
   issues / PRs to avoid duplicate work.

## Ground rules

- Be kind and stay on topic: one issue or PR per problem or feature.
- X Plus is **not affiliated** with X Corp. / Twitter. Do not add copy,
  metadata or UI that implies otherwise.
- By contributing you agree your work is licensed under the repository's
  [MIT License](LICENSE).
- No frontend framework and no TypeScript unless it is explicitly agreed first.
  Keep new dependencies out unless they are clearly worth it — explain why in
  the PR.

## Setup

Requirements: Node.js 22 (see `.nvmrc`), npm, and a userscript manager for
testing.

```bash
git clone https://github.com/NemoKing1210/x-plus.git
cd x-plus
npm ci
npm run ci   # syntax + i18n + READMEs + tests + build + artifact verification
```

`npm run ci` must pass before you start and before you push.

## Development workflow

1. Create a branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
2. Edit files under `src/` only. **Never hand-edit** the generated
   `x-plus.user.js` / `x-plus.meta.js` — they are build output.
3. Build and verify after every change:
   ```bash
   npm run build              # regenerates the root .user.js / .meta.js
   npm run verify:artifacts   # dist/ and root artifacts must match
   ```
4. Test your change:
   ```bash
   npm run harness            # mock x.com page at http://localhost:5179/
   ```
   The harness runs the **built** bundle, so rebuild first. It is a smoke test;
   DOM and selector changes must also be checked against real `x.com` (and
   ideally `twitter.com`).
5. Run `npm run ci` before pushing.

Useful console helpers while testing:

```js
window.__store                          // shimmed GM storage in the harness
localStorage.setItem('xp_debug', '1')   // verbose X Plus traces
```

## Conventions

- Vanilla JavaScript ES modules; no frameworks, no TypeScript.
- Features may depend on `core` and the shared modules (`ui`, `utils`, `i18n`);
  shared modules must never import a feature.
- Settings live in the schema (`src/core/schema.js`). Read them with
  `getFeatureSettings(id)`, change them with `updateFeatureSettings(id, patch)`
  or `saveSettings()` — never call `GM_getValue` / `GM_setValue` directly.
- Features react to settings through `apply(cfg, prev)` and to the page through
  `scan(root)`. Both must be **idempotent** — they run often.
- Prefix DOM classes, attributes and storage keys with `xp-` / `data-xp-` /
  `xp_`.
- Create UI through `el()`: it tags elements with `data-xp-ui`, which scans
  ignore.
- Keep X-specific selectors in `src/core/constants.js` (`SEL`) or at the top of
  the module that needs them. Prefer stable `data-testid` selectors.
- Do not expand `@connect` / `@grant` beyond what is needed; metadata lives in
  `vite.config.js`. Never commit localhost `@updateURL` / `@downloadURL`.
- Colors come from `src/styles/tokens.css` (`var(--xp-*)`); the UI must work in
  X's light, dim and lights-out themes.
- Errors use stable `XP-####` codes from `src/core/debug.js`; user-visible
  failures also get a toast.
- Do not break X's native navigation, composer or infinite scroll.

## Adding a feature, provider or clean-up rule

The full recipes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Short
version:

- **Feature:** create `src/features/<name>/index.js` with `registerFeature`,
  import it in `src/main.js`, and add its strings to every locale.
- **Translation provider:** describe it in
  `src/features/translate/providers/registry.js`, implement
  `translateWith<Name>`, wire it in `src/features/translate/api.js`, and add its
  host to `@connect` in `vite.config.js`.
- **Clean-up rule:** add one entry to `RULES` in
  `src/features/interface/rules.js` plus its label in the locales.

## Localization

UI locales: `en`, `ru`, `zh`, `es`, `pt`, `de`, `fr`, `ja` (plus `auto` =
browser).

- Add every new user-facing string to **all** locale files in
  `src/i18n/locales/`. `npm run check:i18n` fails on a missing key and lists
  unused ones.
- Keep localized `@name` / `@description` in `vite.config.js` aligned with the
  English product description.
- `README.md` is the English source; each locale has `README.<lang>.md` with the
  same headings, code blocks and links. Never edit the generated badge block or
  language switcher by hand — run `npm run readmes` after changing the English
  README, then `npm run check:readmes`.

Machine translation is acceptable for a first pass — note it in the PR so a
native speaker can review it.

## Changelog and versioning

- Add a [Keep a Changelog](https://keepachangelog.com/) entry to
  [CHANGELOG.md](CHANGELOG.md) for user-visible changes. One bullet per
  outcome, no work-log noise.
- A `fix` or `perf` change users can see also bumps the patch version
  (`0.16.0` → `0.16.1`) in `package.json` and gets its own dated
  `## [x.y.z]` section, because userscript managers only update when
  `@version` moves. Run `npm run readmes` after the bump. A feature stays in
  `## [Unreleased]` until the next minor release; minor/major versions are
  handled by the maintainer.

## Testing checklist

- [ ] `npm run ci` passes.
- [ ] Root `x-plus.user.js` / `x-plus.meta.js` regenerated
      (`npm run verify:artifacts` green).
- [ ] Settings panel: changes persist across reload; tabs switch and search
      finds the new controls.
- [ ] The change works on real `x.com` and does not break navigation, the
      composer or infinite scroll.
- [ ] Light, dim and lights-out themes look correct.
- [ ] Every new string exists in all eight locales.

## Pull request process

1. Fork the repo, branch from `main` and commit with clear messages
   (Conventional Commits: `type(scope): subject`).
2. Keep PRs focused; unrelated drive-by refactors will be asked to split out.
3. Fill in the testing checklist above.
4. CI must be green. Patch bumps follow the changelog rule above; minor and
   major releases are handled by the maintainer.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
