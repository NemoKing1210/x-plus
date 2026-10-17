# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Smooth animations: translated text un-blurs and rises into place, the result panel and split view fade in with a shimmer, and the settings dialog, confirmations, popups and toasts animate in (disabled with the system “reduce motion” setting)

## [0.2.1] - 2026-10-17

### Fixed

- The Translate button of an X Article now lands in the header of the article's own post, before the Grok summary button: posts embedded inside the article (each with its own Grok / ⋮) are ignored, and the Grok button is found by its position even when it is labelled in another UI language (e.g. "Составить сводку")

[0.2.1]: https://github.com/NemoKing1210/x-plus/releases/tag/v0.2.1

## [0.2.0] - 2026-10-17

### Added

- **X Articles translation**: a Translate button in the header of the article page next to Grok (a bar above the body when no header is found), or automatic translation on open; title, paragraphs, headings, list items and captions are translated block by block with the configured provider, keeping links, line breaks and bold / italic lines; shown under each block or in place (button / hover peek / split); embedded posts are left untouched; respects the account blocklist, language filters and the cache; works with both the signed-out (Tailwind) and signed-in (draft-js) article markup; new **Translate articles** switch
- Blocks are retried with a growing pause and translated two at a time, so public endpoints that throttle bursts do not break long articles

[0.2.0]: https://github.com/NemoKing1210/x-plus/releases/tag/v0.2.0

## [0.1.0] - 2026-10-17

First release.

### Added

- Feature architecture: features register themselves (`registerFeature`) with a declarative settings schema, optional settings tabs and `init` / `apply` / `scan` / `navigate` hooks; one schema yields defaults, normalization (load / save / import) and the settings UI
- Settings dialog generated from tab specs, with draft editing, live `showIf` visibility, tab badges, Reset / Cancel / Save and a **Backup** tab (JSON export / import)
- **Translation** (port of x-translator): Translate control on posts, replies and quoted posts; button or automatic mode with optional account allowlist; panel or in-place display with *Show original*, hover peek and split view; Google, DeepL, Microsoft, OpenAI-compatible, Yandex and LibreTranslate providers; account blocklist, source-language allow / block lists, native auto-translate detection, post ⋮ menu entries; cache with TTL, usage meter and size budget
- **Media download**: videos, GIFs and photos from the action bar and optionally from buttons over the media; quality rules (best, 1080 / 720 / 480p, smallest, ask), original or large photos, multi-file handling, file name templates, progress toast; anonymous syndication source with a GraphQL fallback for restricted posts
- Optional larger photo renditions in the timeline
- **Interface** clean-up rules: promoted posts, view counts, verified badges, Grok buttons, Who to follow, trends, Premium offers, footer links, left-menu entries and the messages drawer
- Notifications (toasts) with position and duration settings
- UI in 8 languages: English, Russian, Chinese, Spanish, Portuguese, German, French, Japanese
- `npm run check:i18n` (all locales must contain every used key) and a local harness (`npm run harness`) for manual testing

[Unreleased]: https://github.com/NemoKing1210/x-plus/compare/v0.2.1...HEAD
[0.1.0]: https://github.com/NemoKing1210/x-plus/releases/tag/v0.1.0
