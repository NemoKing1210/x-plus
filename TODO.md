# X Plus — TODO

Planned, in-progress and recently finished work for X Plus. The format follows
the [todo.md spec](https://github.com/todomd/todo.md): each section is a Kanban
column, `- [ ]` is an open task, `- [x]` is done, and the completed column is
named with `✓`. Metadata sits at the end of a title — `~estimate #scope @owner
yyyy-mm-dd` — and sub-tasks are two-space-indented checkboxes. Two trailing
spaces keep every task on its own line on GitHub.

How to take a task, plan it and close it: [AGENTS.md](AGENTS.md#tasks-and-todomd).
Bug reports and feature discussion live in
[GitHub Issues](https://github.com/NemoKing1210/x-plus/issues); mirror anything
you are about to work on here.

### Todo

- [ ] Live pass with the rebuilt script installed ~2h #test @NemoKing1210  
  - [ ] Install in Tampermonkey, Violentmonkey and ScriptCat: every feature boots, the settings entry appears  
  - [ ] Home → post → replies → back: no duplicate buttons, no stale owners, no new `XP-3002`  
  - [ ] Promoted post, native translate bar, Following/Explore tabs, narrow layout, light / dim / lights-out  
  - [ ] Layout settings (`Content width`, `Sidebar right`, `Center content`, `Hide menu`) change only the feed and menu, not the whole row or the sidebar footer  
  - [ ] `Hide handles` and `Who to follow (sidebar)` on the modern build touch only the handle rows and the module, not the post text or the whole right column  
  - [ ] Photo viewer, X Article, composer, post menu and Shorts on the live modern build  
- [ ] Review UI strings in all eight locales ~1d #i18n @NemoKing1210  
  - [ ] `npm run check:i18n` reports no missing or unused keys  
  - [ ] Native speakers confirm the machine-translated strings  
- [ ] Test the built script in every supported manager and X theme ~1d #test @NemoKing1210  
  - [ ] Tampermonkey, Violentmonkey and ScriptCat install and run  
  - [ ] Light, dim and lights-out themes render the injected UI correctly  
- [ ] Cover every photo of a modern photo grid in the media overlay ~2h #media  
  - [ ] `getMediaHosts` reports one host per media block, so a three-photo grid gets one overlay and `photoIndex` always picks photo 1  
  - [ ] Place one button per photo image (or resolve the clicked image) so each photo downloads its own file and `n` token  
  - [ ] The gallery already enumerates images per host (`photoAt`); reuse that lookup in `media/ui.js`  
  - [ ] Verify on the `/modern` harness grid: photos 1, 2 and 3 download with the right names  

### Done ✓

- [x] Ship user-visible fixes as patch releases ~0.5h #chore @NemoKing1210 2026-11-27
  - [x] `AGENTS.md`, `CONTRIBUTING.md` and `docs/DEVELOPMENT.md`: a `fix` / `perf` change moves the patch version with the change, a feature waits in `[Unreleased]` for the next minor
  - [x] The Shorts smoothness fix is the first one shipped this way (`0.16.1`, README badges and root artifacts rebuilt)
- [x] Make Shorts steps smooth when the feed scrolls ~2h #shorts @NemoKing1210 2026-11-27
  - [x] Measured the step in the harness: animating `filter: blur()` cost ~8 dropped frames per 10 steps, against ~2 when the blur snaps
  - [x] The post transition animates only transform and opacity; the blur switches with the state, and `will-change` no longer reserves a filtered layer
  - [x] The tween eases with smoothstep (half the peak speed of ease-in-out cubic) and assigns `scrollTop` directly
  - [x] A step reuses the units it collected, the nav pulse restarts on the next frame instead of forcing a layout in the input handler, videos resume after the tween lands, and the auto-scroll bar is not rewritten while hidden
  - [x] Unit test pins the non-animated filter; architecture notes and changelog updated; `npm run ci` green
  - [x] Released as 0.16.1 with the rebuilt root artifacts
- [x] Fix the timeline shading from the un-stuck feed tabs ~1h #interface @NemoKing1210 2026-11-26  
  - [x] With “Scroll the feed tabs with the page” on, the modern build shaded the whole timeline at the top of the page until the next scroll  
  - [x] The marked element is X's page `<header>`; setting it to `position: static` dropped it as the containing block of its absolutely positioned frosted backdrop, which then sized against the viewport  
  - [x] The tabs are un-stuck with `position: relative` instead: same flow, but the header keeps its position for its backdrop; verified on the live page (backdrop 1059px → 0)  
  - [x] Unit test pins the relative rule; changelog and docs updated, `npm run ci` green  
- [x] Fix the defects the DOM compatibility audit found ~3h #compat @NemoKing1210 2026-11-26  
  - [x] CSS wrappers no longer nest `:has()`: the action-bar and drawer wrappers match the modern build again, and the content column is sized without growing the box around it, so the centred feed keeps its place  
  - [x] Negative capability answers are no longer cached, so a native translate bar or media block mounted after the first scan is still found  
  - [x] `element-list` answers stay with the owning profile instead of being unioned with the other generation  
  - [x] The modern nav / column / sidebar fragments exclude the legacy markup, and the modern sidebar excludes dialogs  
  - [x] Feed tabs are `/home`-only and the tab block, not the sticky header, is hidden; the “Show N posts” rule is marked legacy-only  
  - [x] Shorts styles only the top-level article; the DOM API excludes the legacy wrapper `<main>`; documented profile fallbacks are implemented  
  - [x] Filtering resolves the focal post once per pass; unused compat exports, the duplicated Shorts hotkeys and the dead spec references are removed  
  - [x] Unit tests for every fix, docs and changelog updated, `npm run ci` green  
- [x] Restyle the Shorts controls as one toolbar ~1h #shorts @NemoKing1210 2026-11-26  
  - [x] Previous / next / auto-scroll share one glass pill with equal 40px targets and the progress ring inside it  
  - [x] Tooltips show the hotkeys (K / J and the auto-scroll key), and a key or wheel step flashes the matching button in place  
  - [x] The ring is hidden while the countdown is paused or off, so an empty circle never sits around the next button  
- [x] Fix the defects the live modern pass reported ~4h #compat @NemoKing1210 2026-11-26  
  - [x] The logo above the home menu is hidden without touching the nav column; post headers are rebuilt from the display-name link on the `<header>`-less markup  
  - [x] The permalink without a `<time>` element resolves media downloads and screenshot names again  
  - [x] Card radius, fill and dividers apply to the cell's hover surface, not the narrower article inside it  
  - [x] “Discover more” and “Who to follow” blocks are found without `role="heading"`, including the cell that also holds the first recommended post  
  - [x] The X Plus menu row keeps its icon and pill, and rows flattened by the earlier build are rebuilt  
  - [x] The account switcher below the nav and the profile row are matched again  
  - [x] Post spacing moves the card on the modern build instead of padding inside it  
  - [x] Unit tests for each fix, the modern fixture mirrors the live post shape, docs and changelog updated, `npm run ci` green  
- [x] Restore every feature on X's 2026 DOM with versioned compatibility profiles ~2d #compat @NemoKing1210 2026-11-26 ✓ 2026-11-26  
  - [x] `core/compat` resolver, generation detection, report, CSS unions and `XP-3001..XP-3004` diagnostics  
  - [x] Legacy and modern DOM profiles with every capability implemented  
  - [x] Feature modules migrated to `dom.*`; no X selectors left outside the profiles  
  - [x] Modern harness fixture, docs, changelog and a full verification pass  
- [x] Cut the next release once `[Unreleased]` has user-visible changes ~1h #chore @NemoKing1210 2026-11-22  
  - [x] Bump `version` in `package.json` and move the `[Unreleased]` notes under it  
  - [x] Run `npm run ci` and `npm run readmes`; commit the rebuilt root artifacts  
- [x] Let photos be saved or copied to the clipboard ~2h #media @NemoKing1210 2026-11-22  
  - [x] Save / Copy menu on the photo button and in the multi-file picker; copy button in the gallery  
  - [x] PNG conversion with clipboard-image support detection; errors surface as toasts  
- [x] Add `TODO.md` and document the task workflow in `AGENTS.md` 2026-11-22  
