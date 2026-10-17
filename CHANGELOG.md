# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-17

### Added

- **X Articles translation**: a toolbar above the article body with a Translate button (or automatic translation on open); title, paragraphs, headings, list items and captions are translated block by block with the configured provider, keeping links, line breaks and bold / italic lines; shown under each block or in place (button / hover peek / split); embedded posts are left untouched; respects the account blocklist, language filters and the cache; works with both the signed-out (Tailwind) and signed-in (draft-js) article markup; new **Translate articles** switch
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

[Unreleased]: https://github.com/NemoKing1210/x-plus/compare/v0.2.0...HEAD
[0.1.0]: https://github.com/NemoKing1210/x-plus/releases/tag/v0.1.0
