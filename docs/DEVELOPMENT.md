# Development

Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Agent / contributor rules:
[../AGENTS.md](../AGENTS.md).

## Requirements

Node.js 22 (see `.nvmrc`).

```bash
npm install
npm run dev               # userscript dev server (dev: prefix)
npm run build             # build + refresh root x-plus.user.js / x-plus.meta.js
npm run check:i18n        # every used key must exist in every locale
npm run verify:artifacts  # dist/ and root artifacts must match
npm run ci                # check:i18n + build + verify (CI gate)
npm run harness           # local mock of x.com for manual testing (see below)
```

Edit files under `src/` and rebuild — the root `.user.js` / `.meta.js` are
generated, never hand-edited.

## Local testing

### In a userscript manager

- **Violentmonkey:** `npm run build`, install the local `x-plus.user.js`, enable
  **Track local file**, rebuild after changes and reload the page.
- **Tampermonkey:** reinstall the rebuilt file, or use `npm run dev` and install
  the generated dev script.

### Harness (no X account needed)

`npm run build && npm run harness` serves <http://localhost:5179/>: a page that
mimics X's DOM (posts, quote card, video post, promoted post, sidebar, ⋮ menu),
shims `GM_*` with `localStorage`, and forwards `GM_xmlhttpRequest` through a
local `/proxy`. The harness page runs the **built** userscript, so rebuild after
every change. It is a smoke-test tool: selectors are verified against real X
only in the browser extension, so re-check there before a release.

Useful in the console while testing:

```js
window.__store                     // the shimmed GM storage
localStorage.setItem('xp_debug', '1')   // verbose X Plus traces
```

## Verifying X selectors

When X changes its markup, features degrade silently (no button, no hiding).
All selectors are centralised:

| What | Where |
|------|-------|
| tweet, text, quote, caret, photo, player, sidebar … | `src/core/constants.js` → `SEL` |
| quote header row classes, native translate icon | `src/core/constants.js` |
| promoted-post markers, sidebar block detection, nav hrefs | `src/features/interface/rules.js` |
| header action slot (Grok / caret) | `src/features/translate/placement.js` |
| sidebar nav template | `src/features/settings/nav-button.js` |

## Releasing

1. Bump `version` in `package.json` once per release (SemVer).
2. `npm run ci` — builds and refreshes the root `x-plus.user.js` / `.meta.js`.
3. Move the `[Unreleased]` notes of `CHANGELOG.md` under the new version.
4. Update `README.md` wherever the change is user-visible.
5. Commit the root artifacts together with the sources: `@updateURL` /
   `@downloadURL` point at them on `main`.
