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

## DOM generations

X runs two builds of its web client: the **legacy** markup (`data-testid`
hooks, `r-*` atomic classes) and the **modern** one (`data-slot`, `xds`,
`data-engagement-action`). X Plus detects the build structurally — never by
hostname or user agent — and answers every structural question through the
compat layer in `src/core/compat/`.

| Signal | Meaning |
|--------|---------|
| `document.documentElement.dataset.xpDom` | `legacy`, `modern` or `unknown` |
| `dataset.xpDomBuild` | X's own `data-app-version`, when it ships one |
| `?force=legacy` / `?force=modern` on the harness, `window.__XP_FORCE_DOM__` | force a profile for testing |
| `window.__xpCompat` (verbose mode only) | `{ dom, report(), refresh(), generation() }` |

Both fixtures run the built bundle: <http://localhost:5179/> (legacy) and
<http://localhost:5179/modern>. A page whose build is not recognised yet is
handled by the modern profile first (`XP-3001` warns), and the layer detects
again after the next scan.

### Where X knowledge lives

| What | Where |
|------|-------|
| capability implementations | `src/core/compat/profiles/legacy.js`, `modern.js` |
| CSS fragments (`article`, `cell`, `trend`, …) | the `css` object of each profile |
| capability names and answer kinds | `src/core/compat/kinds.js` |
| detection probes | each profile's `detect(root)` |
| feature code | nowhere: it calls `dom.*` and builds CSS with `cssFor()` |

A source-level test (`test/compat-imports.test.js`) fails when a file under
`src/features/` or `src/ui/` imports a profile or carries a `data-testid`,
`xds-`, `header[role="banner"]` or atomic `r-*` selector. The single
documented exception is `nav-button.js`, which seeds `navHoverClass` with a
legacy `r-*` hover pill class. It is only a starting value — the class name is
learned from X's own menu rows at runtime — and the whole hover mirror is
skipped on the modern page, which styles the row with CSS.

### Adding a capability

1. Add the name and its answer kind to `KINDS` (`src/core/compat/kinds.js`).
2. Implement it in both profiles; return `undefined` where that build does not
   have the thing, so the resolver falls through to the other profile.
3. Pin the selectors it uses in `test/compat-profiles.test.js`.
4. Call `dom.<name>()` from features and add the name to the brief of the task
   that consumes it.

### Adding a third profile

1. Create `src/core/compat/profiles/<id>.js` exporting `{ id, detect, api, css }`.
2. Register it in `PROFILES` (`src/core/compat/index.js`); the order is
   priority, newest build first, because `detect` stops at the first match.
3. Answer only what differs — an `undefined` answer means "not mine, ask the
   next profile", while an owned element's empty answer stays final.
4. Add only the CSS fragments it changes; `cssFor()` unions the ones it does
   not define.
5. Add the build to the rule table below, run the harness with
   `?force=<id>` (and the dedicated fixture), then update the selector table
   in the design spec.

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
| `posts.composer` | inline composer (`tweetTextarea_0`) | the card around the composer form |
| `posts.moreFromX` | heading cell after the replies | the first cell after the focal post that carries a section heading — the heading shares its cell with the first recommended post and has no `role="heading"` |
| `posts.promoted` | promoted badge markers | `dom.isPromotedArticle` |
| `posts.viewCounts` | analytics link in the action bar | same (`role="group"` + `/analytics`) |
| `posts.avatars`, `posts.images`, `posts.videos` | avatar / `tweetPhoto` / player | `data-post-avatar`, media holders |
| `posts.linkCards`, `posts.articles` | card attachments | card attachments |
| `posts.translateNotice` | native translate bar | native translate bar |
| `posts.handles`, `posts.quotedPosts` | header handle, quote card | the handle in the author row, quote card |
| `posts.actionBar` | `[role="group"]` with a reply button | `[role="group"]` with `data-engagement-action` |
| `posts.verifiedBadges` | `icon-verified` | verified icon |
| `posts.grokButton` | Grok glyph in the header | Grok glyph in the author actions row |
| `posts.whoToFollow` (in the feed) | heading cell + `UserCell` cells | cell heading (no `role`) + `[data-who-to-follow]` accounts, in one cell or in following cells |
| `sidebar.search` | `form[role="search"]` | `form[role="search"]` |
| `sidebar.premium` | premium link in a sidebar block | premium link in a sidebar section |
| `sidebar.trends` | `[data-testid="trend"]` | `[data-trend]`, or a sidebar link to a search query |
| `sidebar.whoToFollow` | `UserCell` cells | `[data-who-to-follow]` modules |
| `sidebar.footer` | footer `nav` with a `/tos` link | footer `nav` with a `/tos` link |
| `nav.*` (logo … account) | links and buttons of the left menu | `dom.getNavItem` on the modern nav |
| `nav.logo` | the spacer wrapper around the logo `<h1>` | the logo's `<h1>`, or the bare spacer above the nav on the home column; never the nav column |
| `nav.xplus` | our entry inside the left column | our entry inside the modern nav |
| `chrome.grokDrawer` | wrapper of `[data-testid="GrokDrawer"]` | dock window carrying the Grok icon |
| `chrome.chatDrawer` | wrapper of `[data-testid="chat-drawer-root"]` | dock window carrying the chat icon |

Layout options follow the same split: `menuLeft`, `menuCenter`, `contentWidth`,
`centerContent` and the column show/hide rules use the layout fragments
(`leftNav`, `leftNavList` / `navCenter`, `primaryColumn`, `sidebarColumn`), and
a modern fragment must never also match legacy markup. Post appearance uses
`postSurface`: the article inside a timeline cell on the legacy build, the
cell's own `div` on the modern one, which is the block X rounds and colours
(the article inside it is narrower).

"Legacy only" is temporary: once the modern marker is known, add it as a
`css` fragment to the modern profile and drop `generations` from the rule.

**Modern post shape.** A post is `article.flex.flex-col` with no `<header>`: the
author row (`div.@container/post-actions`) holds the name link, the handle, the
caret and the permalink; `dom.getAuthorHeader` rebuilds it by climbing from the
display-name link and stopping before the post text. The permalink carries no
`<time>` element (`dom.getTimeLink` matches `/status/<id>` on the article's own
link), and the hover container around the article is the surface that cards
style.


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
