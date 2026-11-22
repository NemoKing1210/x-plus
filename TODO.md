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

- [ ] Cut the next release once `[Unreleased]` has user-visible changes ~1h #chore @NemoKing1210  
  - [ ] Bump `version` in `package.json` and move the `[Unreleased]` notes under it  
  - [ ] Run `npm run ci` and `npm run readmes`; commit the rebuilt root artifacts  
- [ ] Re-verify X selectors against the live site ~1d #fix @NemoKing1210  
  - [ ] `SEL` in `src/core/constants.js` still matches the current `data-testid`s  
  - [ ] Update the selector tables in `docs/DEVELOPMENT.md` and the harness DOM if anything moved  
- [ ] Review UI strings in all eight locales ~1d #i18n @NemoKing1210  
  - [ ] `npm run check:i18n` reports no missing or unused keys  
  - [ ] Native speakers confirm the machine-translated strings  
- [ ] Test the built script in every supported manager and X theme ~1d #test @NemoKing1210  
  - [ ] Tampermonkey, Violentmonkey and ScriptCat install and run  
  - [ ] Light, dim and lights-out themes render the injected UI correctly  

### In Progress

_No active task._

### Done ✓

- [x] Let photos be saved or copied to the clipboard ~2h #media @NemoKing1210 2026-11-22  
  - [x] Save / Copy menu on the photo button and in the multi-file picker; copy button in the gallery  
  - [x] PNG conversion with clipboard-image support detection; errors surface as toasts  
- [x] Add `TODO.md` and document the task workflow in `AGENTS.md` 2026-11-22  
