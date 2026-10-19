# Architecture

X Plus is a set of independent **features** running on a small **core**. A
feature owns one section of the settings object, may contribute settings tabs
and reacts to a few lifecycle hooks. Everything else — persistence,
normalization, the settings UI, DOM observation, i18n — is shared.

## Repository layout

```text
src/
├── main.js                  # Boot: load settings → init/apply features → start observers
├── core/
│   ├── constants.js         # Identity, storage keys, X selectors (SEL), timings
│   ├── schema.js            # Declarative settings schema: field.bool/enum/int/text/list/record
│   ├── features.js          # Feature registry (registerFeature, hooks)
│   ├── settings.js          # Load / save / import / export + normalization (single source of truth)
│   ├── bus.js               # Pub/sub: settings:*, scan, navigate, theme
│   ├── scan.js              # One MutationObserver + SPA navigation watch
│   ├── theme.js             # Mirrors X's theme (light | dim | dark) into data-xp-theme
│   ├── storage.js           # Safe GM_getValue / GM_setValue
│   ├── http.js              # GM_xmlhttpRequest as a promise (progress, abort)
│   └── debug.js             # XP-#### error codes, verbose mode
├── i18n/
│   ├── index.js             # t(key, vars), configureLocale, resolveTargetLang
│   ├── meta.js              # Supported locales, flags, aliases
│   └── locales/             # en ru zh es pt de fr ja — flat 'namespace.key' maps
├── features/
│   ├── general/             # UI language, sidebar button, toast settings
│   ├── translate/           # In-place post translation (port of x-translator)
│   ├── media/               # Video / GIF / photo download + feed image quality
│   ├── shorts/              # Shorts mode: one post at a time (wheel / arrows), focus + blur
│   ├── interface/           # Declarative clean-up rules (ads, suggestions, menu entries)
│   └── settings/            # Settings dialog, spec renderer, nav button, Backup / About tabs
├── ui/                      # icons, toast, popup menu, scroll lock, bottom-left dock
├── utils/                   # dom, html, format, handle, lists, linked-text
└── styles/                  # tokens, base, translate, media, settings (xp- prefix)
```

## Boot sequence

```
whenReady → boot()
  loadSettings()                       # normalize stored blob against every feature's schema
  observePageTheme()                   # data-xp-theme follows X
  for feature in features (by order):
      init()                           # once
      apply(cfg, null)                 # initial configuration
      on('settings:<id>') → apply(cfg, prev)
  on('scan')     → feature.scan(root)  # debounced DOM changes (shared MutationObserver)
  on('navigate') → feature.navigate(url)
  startScanning(); startNavigationWatch(); scanNow()
```

`general` has `order: 0`, so the UI language is configured before any other
feature renders text. Hook failures are isolated and logged
(`XP-1010`); one broken feature never blocks the rest.

## Settings

Settings are `{ [featureId]: featureSettings }`. Each feature describes its
section once with `field.*` builders (`core/schema.js`):

| Builder | Normalization |
|---------|---------------|
| `field.bool(def)` | must be a boolean |
| `field.enum(values, def)` | must be one of `values` (array or function) |
| `field.int(def, {min,max})` | rounded and clamped |
| `field.text(def, {max,trim})` | string, trimmed, length-capped |
| `field.list(kind, def)` | deduplicated, normalized items (`handle` / `lang` / `text`) |
| `field.record(fields)` | nested object, recursively normalized |

The same schema yields the defaults, the normalizer applied on **load, save
and import** (unknown keys are dropped, invalid values fall back to defaults,
so a corrupt or hostile backup can never put the script in an invalid state),
and the defaults used by Reset. `saveSettings()` persists and emits
`settings:<featureId>` for every changed section plus `settings:changed`.

Feature code reads its section with `getFeatureSettings(id)` (always the live,
normalized object) and changes it with `updateFeatureSettings(id, patch)`.

## Adding a feature

1. Create `src/features/<name>/index.js`:

   ```js
   import { registerFeature } from '../../core/features.js';
   import { field } from '../../core/schema.js';

   registerFeature({
     id: 'example',
     order: 40,
     fields: { enabled: field.bool(true), mode: field.enum(['a', 'b'], 'a') },
     tabs: [{
       id: 'example',
       titleKey: 'example.title',
       badge: (draft) => (draft.example.enabled ? '' : t('common.off')),
       sections: [{
         titleKey: 'example.section',
         controls: [
           { type: 'switch', path: 'enabled', labelKey: 'example.enabled' },
           { type: 'select', path: 'mode', labelKey: 'example.mode',
             options: [{ value: 'a', labelKey: 'example.mode.a' }, …],
             showIf: (section) => section.enabled },
         ],
       }],
     }],
     init() {},                       // once
     apply(cfg, prev) {},             // initial + on every change of settings.example
     scan(root) {},                   // debounced DOM changes
     navigate(url) {},                // SPA navigation
   });
   ```

2. `import './features/<name>/index.js'` in `src/main.js`.
3. Add every user-facing string to **all** locales (`npm run check:i18n`
   fails otherwise).

That is all: the section is persisted, normalized, exported/imported, reset,
and gets its tab in the settings dialog.

## Settings UI

The dialog (`features/settings/`) edits a **draft** copy of the settings;
nothing is saved or applied until **Save**. Tabs are collected from the
registry (feature `order`, then declaration order). A tab is either a spec
(`sections` → `controls`, rendered by `renderer.js`) or fully custom
(`render(ctx)`).

**Search** (`settings/search.js`): the index is built from the tab specs (labels, hints, section titles, select options), so it covers tabs that were never opened and needs no extra declaration — a new control is searchable as soon as it has a `labelKey`. The renderer tags every control / section with `data-xp-find`; a result opens its tab, scrolls to that node and flashes it (falling back to the section when a `showIf` hides the control).

Control types: `switch`, `select`, `number`, `text` / `password` / `url`,
`list` (chips for handles / languages), `hint`, `button`, `group`, `custom`.
`path` is relative to the feature's section and may be dotted. Any control or
section accepts `showIf(section, root)`; visibility is re-evaluated on every
edit. Tab `badge(draft)` renders a live pill next to the title.

## Features

### translate

Port of [x-translator](https://github.com/NemoKing1210/x-translator): same
providers (Google, DeepL, Microsoft, OpenAI-compatible, Yandex, LibreTranslate),
cache, display modes, filters and DOM placement logic.

```
scan → findPostTextRoots() → enhancePost(el)
  → button in the tweet header (before Grok / caret; end of the name row in quotes)
  → click / IntersectionObserver (auto mode, max 2 in flight)
      → extractLinkedText()          # links → private-use tokens, emoji <img> → text
      → translateText(text, lang)    # cache(provider|lang|text) → inflight dedupe → provider
      → showResult()                 # panel | replace (button / hover peek / split)
```

| File | Role |
|------|------|
| `controller.js` | Per-post orchestration, click handling, auto queue, `scanPosts()` |
| `placement.js` | Where chrome lives in X's DOM (header slot, toolbar, quote cards) |
| `display.js` | Result panel, in-place replace, split view, hover peek badge |
| `button.js` | Button states (idle / loading / shown) |
| `native.js` | Detection of X's own auto-translation bar |
| `author.js`, `filters.js`, `allowlist.js` | Author handle, blocklists, language filters |
| `post-menu.js` | Entries in a post's ⋮ menu |
| `article.js` | X Articles: header button (shared slot with posts) + progress bar, block extraction (lines / links / bold), per-block translation with retries, panel or in-place display |
| `api.js`, `cache.js`, `providers/` | Translation requests, GM cache with TTL + budget, provider clients |

**New provider:** describe it in `providers/registry.js` (fields + defaults →
the settings schema and UI follow), implement `translateWith<Name>`, wire it
in `api.js`, add its host to `@connect` in `vite.config.js`.

### media

`viewer.js` is independent of downloads: delegated capture-phase listeners (wheel, pointer, dblclick, keys) apply a CSS transform to the `<img>` of X's full-screen photo view (`SEL` in the file header) and swap in `name=orig` while zoomed.

`gallery.js` (setting `photoGallery`, off by default) intercepts a primary click on a post photo in the capture phase (`SEL.photo` inside an article; Ctrl / Cmd / Shift / Alt clicks and buttons on the photo are left alone), collects the photos of that post / quote from the DOM (`getMediaHosts`) and shows them in its own full-screen overlay (`styles/gallery.css`) — no route change, no extra requests besides the images (`name=large`, `orig` once zoomed). It owns its keys (`Esc`, `←` `→`, `+` `-` `0`) and closes on navigation.

```
click → getTweetId(article)
      → resolveTweetMedia(id)         # memoized 10 min
           1. syndication endpoint    # anonymous, no cookies, no rotating ids
           2. X web GraphQL           # viewer's session; for posts (1) does not return
      → filter by enabled kinds / overlay target
      → buildEntries()                # one per file; "ask" lists every quality
      → picker (popup) or direct download
      → downloadFile()                # GM_xmlhttpRequest blob + progress → <a download>
```

- Only **MP4** renditions are offered (HLS-only videos are reported as such).
- File names come from a template (`{user}` `{id}` `{date}` `{time}` `{n}`
  `{quality}` `{type}` `{text}`), sanitized for every file system.
- The GraphQL fallback is best-effort: the query id rotates with X's web
  client (it is discovered from the loaded bundles, known ids are tried
  first) and missing feature flags reported by the server are filled in once.

### shorts

`engine.js` (setting `enabled`, off by default; switchable from the settings tab and from `dock-switch.js`, the switch in the bottom-left dock `ui/dock.js` next to the shortcut reminder) turns the feed into a post-by-post view on feed pages (anything but `/…/status/…`, messages, settings, Grok). Capture-phase `wheel` / `keydown` listeners step to the neighbouring post cell (`SEL.cell` containing `SEL.article`) with an own `requestAnimationFrame` tween on `window.scrollTo` that re-reads the target every frame, so X's virtualization and infinite scroll are untouched. One step per wheel gesture (the decaying tail of a trackpad flick is ignored); a post taller than the screen scrolls natively until its edge is visible; wheel and keys are left alone over the sidebar, dialogs / menus / the gallery, text inputs and fullscreen video.

The nearest cell to the screen middle gets `data-xp-shorts="active"`, the other post cells `aside`; `styles/shorts.css` scales / blurs the `article` inside (never the cell: X positions cells with transforms). `nav.js` draws the previous / next buttons (setting `buttons`): a fixed, vertically centred pair at the right edge of `SEL.primaryColumn` — in the gap before the right column when it is wide enough, over the feed's edge otherwise — hidden while a dialog / menu is open; `engine.js` feeds it the enabled states on every `update()`.

`<html data-xp-shorts-on>` exists only while the mode is engaged on the current page.

### interface

`rules.js` is a list of declarative rules (`group`, `key`, and one of `css`,
`inArticle(article, memo)` or `find(root)`); `engine.js` writes one generated
stylesheet for the enabled rules and marks JS-found targets with
`data-xp-hide~="<rule>"`. Adding a rule = one entry in `RULES` + its label in the
locales; defaults, schema and the settings switch follow.

Speed rules of thumb, fastest first:

1. **`css`** (a selector or a list, `:has()` / `:only-child` with shallow
   child-combinator chains): no JS, instant, no flash. Prefer it whenever the
   target can be expressed that way. Avoid deep `:has()` and nested `:has()`.
2. **`inArticle`**: per-post finder for what CSS cannot find (text, climbing to
   a wrapper). The engine runs it only for posts that were added or changed,
   synchronously inside its own `MutationObserver` callback (before paint, with a
   per-callback time budget) and takes back marks that stop applying, since X
   reuses DOM nodes. Share work between rules through the `memo` map.
3. **`find`**: page-level targets outside posts (menu, sidebar, composer); runs
   in a throttled pass, never on every mutation.

The feature has no `scan` hook on purpose: the shared debounced scan would be
starved by X's constant DOM churn and walks the whole page.

## Conventions

- Vanilla ES modules, no frameworks. GM APIs are imported from `$`.
- Every element we create uses the `xp-` class prefix and the `data-xp-ui`
  attribute (via `el()`), so scans ignore it; enhanced post text carries
  `data-xp-post`. Storage keys use the `xp_` prefix.
- Every X-specific selector lives in `core/constants.js` (`SEL`) or at the top
  of the module that needs it — X's DOM changes often, keep fixes one-line.
- Colors come from `styles/tokens.css` (`var(--xp-*)`), which follows X's
  theme (light / dim / lights-out).
- Errors carry stable `XP-####` codes (`core/debug.js`); verbose traces via
  `localStorage.setItem('xp_debug', '1')`.
