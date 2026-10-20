# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Shorts mode (Shorts tab in settings, or the switch next to the `Ctrl + M` reminder at the bottom left): browse the feed one post at a time like YouTube Shorts (a post and its replies joined by a thread line count as one) — the wheel or `↑` / `↓` (`J` / `K`, `Space`) jumps to the previous / next post and centres it, the current post grows a little and the posts around it are blurred; ↑ / ↓ buttons beside the post work with the mouse; auto-scroll can move to the next post by itself after a set time (waits for longer videos, pauses over the buttons) with a progress ring on the “next” button or a bar over the post, selectable in settings; a key (`P` by default, changeable in settings) pauses and resumes it; automatic translation can be limited to the current post (after it stays in the middle for a moment) to save API requests, with the next post translated in advance and shown only when you get to it; size, blur, the opacity of the previous / next post and transition speed are adjustable
- Translation settings: “Hide translation errors” (on by default) — a failed translation no longer shows “Translation failed. Try again.”, the post just stays untranslated; turn it off to see the message again

## [0.8.0] - 2026-10-18

### Added

- Settings: search across all tabs — type a word (any part of a name, hint or option), pick a result with the mouse or `↑` / `↓` + `Enter`, and the dialog opens the right tab, scrolls to the setting and highlights it; `/` or `Ctrl` / `Cmd` + `K` focuses the search, `Esc` clears it

## [0.7.0] - 2026-10-18

### Added

- Media settings → Photo viewer: “Open photos in the X Plus gallery” — a click on a post photo opens a fast full-screen gallery instead of X’s photo page, so replies and the timeline are not loaded; browse all photos of the post (thumbnails, `←` / `→`, swipe), zoom (also out, below the fitted size) and pan, download a photo or open the original, close with `Esc`

## [0.6.1] - 2026-10-18

### Changed

- Interface hide rules are much faster and no longer flash: simple ones are pure CSS, the rest run only for posts that appeared or changed, before the browser paints, instead of rescanning the whole page every few hundred milliseconds

## [0.6.0] - 2026-10-18

### Added

- Interface settings: the “Post appearance” section is now **Post** and gathers everything about a single post, including its hide switches
- Interface settings → Post: hide avatars (the avatar shape is locked while they are hidden), quoted posts, images, videos, link previews, articles, the “Source language” notice, @handles and the action bar (reply, repost, like, share)

## [0.5.0] - 2026-10-18

### Added

- Interface settings: hide “Discover more” and the recommended posts below the replies on a post’s page
- Interface settings: new “Post appearance” section — posts as cards (outline, filled or shadow, corner radius), space between posts, inner padding, hide dividers, text size and avatar shape, all with a live preview
- Interface settings: hide the floating “Show new posts” button and the “Show N posts” row at the top of the timeline

## [0.4.0] - 2026-10-18

### Added

- Interface settings: hide the Home and X Plus entries in the left menu
- Ctrl + M opens (and closes) the settings from anywhere on X, with a faint translucent reminder in the bottom left corner of the screen (both can be switched off in General → Interface)
- Interface settings: option to hide the whole left menu; its separate switches are greyed out while it is on (X Plus settings stay available from the userscript manager menu)
- Interface settings: hide the floating Grok panel and the floating Chat panel in the bottom right corner separately
- Interface settings: option to hide the whole right column; its separate block switches and the “right column at the screen edge” option are greyed out while it is on
- Interface settings: hide the search box in the right column; the right-column rules now go top to bottom like the page
- Interface settings: hide the feed tabs (For you / Following …) or stop them floating at the top so they scroll with the page
- Interface settings: hide the “What is happening?” post box above the timeline (the compose dialog still works)

### Changed

- Settings preview now outlines the affected block for layout options too (content width, centring, menu and right column placement, menu centring, floating feed tabs)

### Fixed

- Hiding a right-column block (Premium, trends, who to follow, footer links) no longer leaves an empty bordered frame, and the footer links rule matches X's absolute links again

### Removed

- Interface setting “Messages drawer”

## [0.3.0] - 2026-10-18

### Changed

- Interface tab regrouped by place — Feed, Left menu, Right column, Other — each with a “Layout” part and a “Hide” part, with section descriptions and a hint for every non-obvious switch
- Left menu “Hide” list now matches the real menu and its order: Explore, Notifications, Chat, Calls, Grok, History, Creator Studio, Premium, Follower requests, Profile, More (entries X does not show there — Communities, Lists, Bookmarks, Jobs, Verified Orgs — were removed)

### Added

- Interface settings: hide the site logo, the Post button and the account menu in the left menu
- Interface settings: option to centre the left menu items vertically
- Photo viewer: zoom and move photos in the full-screen view — mouse wheel zooms towards the cursor, drag pans, double click toggles zoom, `+` / `-` / `0` keys, pinch and drag on touch screens, a zoom indicator with reset, and the original-quality photo is loaded while zoomed (Media tab → Photo viewer); zooming out and moving at any scale are supported, and an optional subtle grid behind the photo makes transparent and dark images easier to see
- Interface settings: adjustable width of the central content column: a slider plus presets (default, narrow, wide, wider, full width)
- Interface settings: option to move the left navigation menu to the left edge of the screen
- Interface settings: option to move the right column (search, trends, suggestions) to the right edge of the screen
- Interface settings: option to centre the feed exactly in the middle of the screen
- Interface settings: live preview: hovering a setting fades out the dimming and blur behind the dialog and outlines the element on the page that the setting hides (hidden elements are shown while previewing); layout options preview their layout, and a note appears when there is nothing to show on the current page
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

[Unreleased]: https://github.com/NemoKing1210/x-plus/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/NemoKing1210/x-plus/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/NemoKing1210/x-plus/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/NemoKing1210/x-plus/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/NemoKing1210/x-plus/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/NemoKing1210/x-plus/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/NemoKing1210/x-plus/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/NemoKing1210/x-plus/compare/v0.2.1...v0.3.0
[0.1.0]: https://github.com/NemoKing1210/x-plus/releases/tag/v0.1.0
