# Development

Architecture: [ARCHITECTURE.md](ARCHITECTURE.md). Agent / contributor rules:
[../AGENTS.md](../AGENTS.md).

## Requirements

Node.js 22 (see `.nvmrc`).

```bash
npm install
npm run dev               # userscript dev server (dev: prefix)
npm run build             # build + refresh root x-plus.user.js / x-plus.meta.js
npm run check:syntax      # every source module parses (node --check)
npm run check:i18n        # every used key must exist in every locale
npm run check:readmes     # localized READMEs stay in sync with README.md
npm run readmes           # regenerate README headers (badges, version, language links)
npm test                  # unit tests for pure modules (node:test)
npm run verify:artifacts  # dist/ and root artifacts must match
npm run ci                # syntax + i18n + readmes + tests + build + verify (CI gate)
npm run harness           # local mock of x.com for manual testing (see below)
```

Edit files under `src/` and rebuild — the root `.user.js` / `.meta.js` are
generated, never hand-edited.

## Tests

`npm test` runs Node's built-in test runner over `test/**/*.test.js`. The tests
cover the pure modules only (settings schema, handles / language lists, file
names, media variants, link tokens) — no DOM or userscript manager is needed.
`npm run check:syntax` parses every module separately, so a broken file is
reported before the bundle is built.

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

## Screenshots

README screenshots live in `docs/screenshots/`. They are captures of the
**built** bundle in the local harness (mock posts); refresh the matching image
when a change alters the injected UI, and keep the filenames referenced by
`README.md` the same in every localized README. Reference them with absolute
`raw.githubusercontent.com` URLs so they also render on Greasy Fork / ScriptCat.

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

Documented exception: `nav-button.js` seeds `navHoverClass` with a legacy
`r-*` hover pill class. It is only a starting value — the class name is learned
from X's own menu rows at runtime — and the whole hover mirror is skipped on
the modern page, which styles the row with CSS.

## Clean-up rules per DOM generation

Every switch of the Interface tab is one entry in
`src/features/interface/rules.js`. A rule either works on both generations —
through a `dom.*` capability or a CSS fragment from
`src/core/compat/profiles/*.js` — or its target exists only in the legacy
markup. Such a rule carries `generations: { modern: false }`: it is skipped on
the modern page, its switch is hidden, and a group with no applicable rule
left hides its whole section. Check the page you are on with
`document.documentElement.dataset.xpDom` (`legacy` | `modern` | `unknown`).

| Rule | Legacy | Modern |
|------|--------|--------|
| `posts.feedTabs` | tabs list (`data-testid="ScrollSnap-List"`) | tabs list inside the page header |
| `posts.showPosts` | cell with a `[data-keep-composer-open]` button | same finder; the marker is not confirmed yet |
| `posts.newPostsPill` | wrapper of `[data-testid="pillLabel"]` | **legacy only** — no marker found yet |
| `posts.composer` | inline composer (`tweetTextarea_0`) | composer inside the page header |
| `posts.moreFromX` | heading cell after the replies | same structure |
| `posts.promoted` | promoted badge markers | `dom.isPromotedArticle` |
| `posts.viewCounts` | analytics link in the action bar | same (`role="group"` + `/analytics`) |
| `posts.avatars`, `posts.images`, `posts.videos` | avatar / `tweetPhoto` / player | `data-post-avatar`, media holders |
| `posts.linkCards`, `posts.articles` | card attachments | card attachments |
| `posts.translateNotice` | native translate bar | native translate bar |
| `posts.handles`, `posts.quotedPosts` | header handle, quote card | header handle, quote card |
| `posts.actionBar` | `[role="group"]` with a reply button | `[role="group"]` with `data-engagement-action` |
| `posts.verifiedBadges` | `icon-verified` | verified icon |
| `posts.grokButton` | Grok glyph in the header | Grok glyph in the header |
| `posts.whoToFollow` (in the feed) | heading cell + `UserCell` cells | heading cell + `[data-who-to-follow]` cells |
| `sidebar.search` | `form[role="search"]` | `form[role="search"]` |
| `sidebar.premium` | premium link in a sidebar block | premium link in a sidebar section |
| `sidebar.trends` | `[data-testid="trend"]` | `[data-trend]` |
| `sidebar.whoToFollow` | `UserCell` cells | `[data-who-to-follow]` modules |
| `sidebar.footer` | footer `nav` with a `/tos` link | footer `nav` with a `/tos` link |
| `nav.*` (logo … account) | links and buttons of the left menu | `dom.getNavItem` on the modern nav |
| `nav.xplus` | our entry inside the left column | our entry inside the modern nav |
| `chrome.grokDrawer` | wrapper of `[data-testid="GrokDrawer"]` | **legacy only** — no marker found yet |
| `chrome.chatDrawer` | wrapper of `[data-testid="chat-drawer-root"]` | **legacy only** — no marker found yet |

"Legacy only" is temporary: once the modern marker is known, add it as a
`css` fragment to the modern profile and drop `generations` from the rule.


## Localized READMEs

`README.md` is the English source. The other supported UI languages have their
own files: `README.ru.md`, `README.zh.md`, `README.es.md`, `README.pt.md`,
`README.de.md`, `README.fr.md`, `README.ja.md`.

The badge block and the language switcher at the top are generated — never edit
them by hand. `npm run readmes` rewrites that block in every file (version from
`package.json`, links to the install script and the other languages);
`npm run check:readmes` (part of `npm run ci`) fails when a header is stale,
when a translation loses a heading, code fence or link target, or when the raw
install URL is missing.

When user-visible behavior changes, update the English README, mirror the change
in every translation, then run `npm run readmes` and `npm run check:readmes`.

## Releasing

1. Bump `version` in `package.json` once per release (SemVer).
2. `npm run ci` — builds and refreshes the root `x-plus.user.js` / `.meta.js`.
3. Move the `[Unreleased]` notes of `CHANGELOG.md` under the new version.
4. Update `README.md` wherever the change is user-visible, mirror it in the
   localized READMEs and run `npm run readmes`.
5. Commit the root artifacts together with the sources: `@updateURL` /
   `@downloadURL` point at them on `main`.
