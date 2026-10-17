# X Plus

[![CI](https://github.com/NemoKing1210/x-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/NemoKing1210/x-plus/actions/workflows/ci.yml)
[![Install userscript](https://img.shields.io/badge/Install-userscript-0f1419?style=for-the-badge&labelColor=1d9bf0)](https://raw.githubusercontent.com/NemoKing1210/x-plus/main/x-plus.user.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.1-green?style=for-the-badge)](CHANGELOG.md)

A userscript for [X](https://x.com) that adds **in-place post translation**,
**video / GIF / photo download** and a set of **interface clean-ups** — all
configurable from one settings panel that follows X's light / dim / lights-out
theme.

> Not affiliated with X Corp. / Twitter.

## Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/),
   [Violentmonkey](https://violentmonkey.github.io/) or
   [ScriptCat](https://scriptcat.org/).
2. Install from the raw URL (the script updates itself from `main`):

```
https://raw.githubusercontent.com/NemoKing1210/x-plus/main/x-plus.user.js
```

| Manager | Path |
|---------|------|
| Tampermonkey | Dashboard → **Utilities** → **Install from URL** |
| Violentmonkey | Dashboard → **+** → **Install from URL** |
| ScriptCat | **Install from URL** with the raw URL |
| Manual | Open `x-plus.user.js`, copy it, create a new script and paste |

Open the settings from the **X Plus** entry in X's left menu or from the
userscript manager's menu command.

## Features

### Translation

Same engine as [x-translator](https://github.com/NemoKing1210/x-translator):

- **Translate** control in the header of every post, reply and quoted post
- **X Articles**: the Translate button in the article header (next to Grok) translates it paragraph by paragraph (title, lists and captions included) — links, line breaks and bold headings survive; shown under each paragraph or in its place
- Modes — on button click, or **automatic** as soon as a post is visible
  (optionally only for selected accounts)
- Display — **replace** the text in place (default), or a separate panel with *Show
  original*, *peek original on hover* or a *split* original + translation view
- Providers — Google (no key), DeepL, Microsoft, OpenAI-compatible, Yandex,
  LibreTranslate
- Per-account blocklist, source-language allow / block lists, skip posts that
  X already auto-translated, entries in the post's ⋮ menu
- Link- and emoji-aware: URLs and hashtags survive translation intact
- Local cache with TTL, usage meter and soft size budget

### Media download

- Button in the post's action bar and (optionally) over each video / photo
- Videos, GIFs and photos; quoted posts included
- Video quality: best, up to 1080 / 720 / 480p, smallest, or **ask every time**
  (picker lists every rendition with its bitrate)
- Photos in original or large quality; several files → ask or download all
- File name template: `{user}` `{id}` `{date}` `{time}` `{n}` `{quality}`
  `{type}` `{text}`
- Progress toast; works without a login via X's public syndication endpoint
  and falls back to your session for posts it does not return
- Optional larger photos while browsing the timeline

### Interface

Toggle-based clean-up rules: promoted posts, view counts, verified badges,
Grok buttons, *Who to follow*, trends, Premium offers, footer links, left-menu
entries (Premium, Grok, Communities, Lists, Bookmarks, Jobs, Verified Orgs) and
the messages drawer.

### Settings

- Tabs: **General · Translation (incl. provider) · Cache · Media · Interface ·
  Backup · About**; edits are drafted and applied on **Save**
- UI languages: English, Русский, 中文, Español, Português, Deutsch, Français,
  日本語 (or automatic)
- Notifications: on / off, corner, display time
- **Backup:** export / import all settings as JSON, reset to defaults

## Limitations

- Article translation keeps links, line breaks and bold / italic **lines**; bold or italic words inside a sentence are rendered as plain text in the translation.
- Only **MP4** renditions can be saved. Videos that X publishes as an HLS
  stream only are reported as not downloadable.
- The GraphQL fallback for restricted posts depends on X's internal API and may
  break when X changes it; the primary (syndication) path does not.
- X changes its markup often. If a button, hiding rule or placement stops
  working, the selectors to adjust are listed in
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#verifying-x-selectors).
- Translation requests go to the provider you pick (Google by default) from
  your browser. API keys stay in your userscript storage — they are included in
  the JSON export, keep that file private.

## Development

```bash
npm install
npm run build      # build + refresh the root x-plus.user.js / x-plus.meta.js
npm run ci         # i18n check + build + verify artifacts
npm run harness    # mock x.com page for manual testing
```

Architecture, how to add a feature / provider / clean-up rule, and the release
checklist: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
