# Post Screenshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in camera button to every post header that copies the post, as it appears on the page, to the clipboard as a PNG.

**Architecture:** A new `screenshot` feature (`src/features/screenshot/`) mounts a header button through the existing translate placement helpers, renders the article with `modern-screenshot`, writes the PNG through `ClipboardItem` from the click handler, and falls back to a file download. Off by default; no observers of its own, so disabling it costs nothing.

**Tech Stack:** Vanilla ES modules, Vite + `vite-plugin-monkey`, `modern-screenshot` 4.7.x (runtime dependency, bundled), existing `core/` schema/settings/i18n/DOM helpers.

**Spec:** `docs/superpowers/specs/2026-11-15-post-screenshot-design.md`

## Global Constraints

- Feature id `screenshot`, order `15`, master switch `enabled: field.bool(false)` — **off by default**.
- No frameworks, no TypeScript. UI through `el()`, `xp-` classes, `[data-xp-ui]`.
- Settings only through the schema; never call `GM_getValue` / `GM_setValue`.
- Every user-facing string in all 8 locales (`en ru zh es pt de fr ja`); `npm run check:i18n` must pass.
- Our UI is stripped from captures (`[data-xp-ui]`); the live post is never mutated for capture.
- X selectors live in `SEL` (`core/constants.js`) or at the top of the owning module.
- Capture failures log `XP-1501` (`Codes.SCREENSHOT_FAILED`) and toast.
- Do **not** bump `package.json` version. Do **not** commit unless the owner asks.
- Rebuild `x-plus.user.js` / `x-plus.meta.js` with `npm run build` at the end; never hand-edit them.
- No `@connect` / `@grant` changes: `modern-screenshot` uses the page's fetch; X's CDNs allow it and `*` is already connected.

## Review Focus

1. **A post uses its displayed text in every display mode:** replace/split captures the translation, panel mode captures the original text (the panel is our UI) — a user must never get a half-rendered or empty post body.
2. **Clipboard is unavailable or denied** (Firefox, insecure context, permission prompt denied): the click must still produce a PNG file and a warning toast, with no unhandled promise rejection.
3. **X re-renders or recycles the header** while the feature is on: the button re-mounts exactly once; no duplicates, no dead button.
4. **Translate is enabled/disabled independently:** enabling Translate puts its button before ours; disabling Translate never removes ours permanently.
5. **Media edge cases:** a video/GIF without a poster yields a neutral block, a failed image fetch yields the library's placeholder, and the post never collapses.

---

### Task 1: Shared primitives and markers

**Files:**
- Create: `src/ui/action-button.js`
- Modify: `src/features/translate/button.js`
- Create: `src/utils/download.js`
- Modify: `src/features/media/download.js`
- Modify: `src/ui/icons.js`
- Modify: `src/core/debug.js`

**Interfaces:**
- Produces:
  - `src/ui/action-button.js`: `isLoading(btn: HTMLButtonElement): boolean`, `clearButtonLoading(btn): void`, `setButtonLabel(btn, label: string, { loading?: boolean, glyph?: string }): void`
  - `src/utils/download.js`: `saveBlob(blob: Blob, fileName: string): void`
  - `icon('camera')` returns the header-button glyph markup.
  - `Codes.SCREENSHOT_FAILED === 'XP-1501'`.
- Consumes: existing `escapeHtml` (`utils/html.js`), `icon` (`ui/icons.js`).

- [ ] **Step 1: Move the generic button helpers**

Create `src/ui/action-button.js` with the exact bodies currently in
`src/features/translate/button.js` for `isLoading`, `clearButtonLoading` and
`setButtonLabel` (including the `xp-btn--header` title handling and the
`data-xp-label-sig` signature short-circuit).

- [ ] **Step 2: Keep translate imports working**

In `src/features/translate/button.js`, remove the three local definitions and
add:

```js
import { clearButtonLoading, isLoading, setButtonLabel } from '../../ui/action-button.js';

export { clearButtonLoading, isLoading, setButtonLabel };
```

The remaining translate helpers (`isShown`, `applyShownButton`,
`applyIdleButton`, `beginTranslateUi`, `applyNoticeShownButton`) stay unchanged.

- [ ] **Step 3: Move `saveBlob` with no behaviour change**

Create `src/utils/download.js` containing the current `saveBlob` body. In
`src/features/media/download.js`, delete the local definition and import it:

```js
import { saveBlob } from '../../utils/download.js';
```

`downloadFile` keeps calling it. No other module imports `saveBlob` from the
media feature (verified by grep), so nothing else changes.

- [ ] **Step 4: Add the camera glyph**

Add to `PATHS` in `src/ui/icons.js`:

```js
camera:
  'M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5.5A5 5 0 1 1 12 18.5a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
```

- [ ] **Step 5: Add the error code**

In `src/core/debug.js`, after `DECLUTTER_RULE`, add:

```js
/** A post screenshot could not be rendered or delivered. */
SCREENSHOT_FAILED: 'XP-1501',
```

- [ ] **Step 6: Verify the refactor**

Run: `npm run check:syntax && npm run test && npm run build`
Expected: all pass; the build copies `x-plus.user.js` and `x-plus.meta.js` to the repo root.

---

### Task 2: Feature shell, settings and i18n

**Files:**
- Create: `src/features/screenshot/config.js`
- Create: `src/features/screenshot/index.js`
- Modify: `src/main.js`
- Modify: `scripts/check-i18n.mjs`
- Modify: `src/i18n/locales/{en,ru,zh,es,pt,de,fr,ja}.js`

**Interfaces:**
- Produces:
  - `config.js`: `cfg(): { enabled: boolean }`, `ss(key: string, vars?): string`, `ATTR = { button: 'data-xp-shot-btn', action: 'data-xp-shot-action' }`, `SCALE_MIN = 2`, `SCALE_MAX = 3`, `CAPTURE_TIMEOUT_MS = 15000`, `MAX_CANVAS_SIZE = 16384`.
  - `index.js`: registers the feature and exports nothing.
- Consumes: `registerFeature`, `field`, `getFeatureSettings`, `t`.

- [ ] **Step 1: Write the feature config**

`src/features/screenshot/config.js`:

```js
import { getFeatureSettings } from '../../core/settings.js';
import { t } from '../../i18n/index.js';

export const cfg = () => getFeatureSettings('screenshot');
export const ss = (key, vars) => t(`screenshot.${key}`, vars);

export const ATTR = Object.freeze({
  button: 'data-xp-shot-btn',
  action: 'data-xp-shot-action',
});

export const SCALE_MIN = 2;
export const SCALE_MAX = 3;
export const CAPTURE_TIMEOUT_MS = 15_000;
export const MAX_CANVAS_SIZE = 16_384;
```

- [ ] **Step 2: Register the feature and its tab**

`src/features/screenshot/index.js`:

```js
import { registerFeature } from '../../core/features.js';
import { field } from '../../core/schema.js';
import { t } from '../../i18n/index.js';
import { removeAllButtons, scanButtons } from './button.js';

registerFeature({
  id: 'screenshot',
  order: 15,
  fields: { enabled: field.bool(false) },
  tabs: [{
    id: 'screenshot',
    titleKey: 'screenshot.title',
    badge: (draft) => (draft.screenshot.enabled ? '' : t('common.off')),
    sections: [{
      titleKey: 'screenshot.sectionMain',
      descKey: 'screenshot.sectionMainDesc',
      controls: [
        {
          type: 'switch',
          path: 'enabled',
          labelKey: 'screenshot.enabled',
          hintKey: 'screenshot.enabledHint',
        },
      ],
    }],
  }],
  apply(settings) {
    if (!settings.enabled) removeAllButtons();
    else scanButtons();
  },
  scan() {
    scanButtons();
  },
  navigate() {
    scanButtons();
  },
});
```

`button.js` arrives in Task 3. Until then, create a temporary stub with empty
`scanButtons` / `removeAllButtons` exports so the build passes; Task 3 replaces
it. (The two exports are part of this task's interface.)

- [ ] **Step 3: Import the feature in the boot entry**

In `src/main.js`, after the translate import:

```js
import './features/screenshot/index.js';
```

- [ ] **Step 4: Teach the i18n checker the namespace and scoped helper**

In `scripts/check-i18n.mjs`, add `'screenshot'` to `NAMESPACES`, and to the
`scoped` array:

```js
[/\bss\(\s*'([\w.]+)'/g, 'screenshot.'],
```

- [ ] **Step 5: Add the strings to all eight locales**

In every locale file, add this block (translated values below; keep the keys
identical):

```js
'screenshot.title': '…',
'screenshot.sectionMain': '…',
'screenshot.sectionMainDesc': '…',
'screenshot.enabled': '…',
'screenshot.enabledHint': '…',
'screenshot.button': '…',
'screenshot.copying': '…',
'screenshot.copied': '…',
'screenshot.saved': '…',
'screenshot.captureFailed': '…',
```

English values:

```js
'screenshot.title': 'Screenshot',
'screenshot.sectionMain': 'Screenshot',
'screenshot.sectionMainDesc': 'Copy a post as a PNG image to the clipboard.',
'screenshot.enabled': 'Enable post screenshots',
'screenshot.enabledHint': 'Adds a camera button to the post header. The image is copied to the clipboard; if the browser cannot copy images, it is saved as a file.',
'screenshot.button': 'Copy post as image',
'screenshot.copying': 'Copying…',
'screenshot.copied': 'Post copied to the clipboard',
'screenshot.saved': 'Could not copy the image — saved as a file',
'screenshot.captureFailed': 'Could not create the screenshot',
```

Translations:

```js
// ru
'screenshot.title': 'Скриншот',
'screenshot.sectionMain': 'Скриншот',
'screenshot.sectionMainDesc': 'Копировать пост как PNG-изображение в буфер обмена.',
'screenshot.enabled': 'Включить скриншоты постов',
'screenshot.enabledHint': 'Добавляет кнопку камеры в шапку поста. Изображение копируется в буфер обмена; если браузер не умеет копировать картинки, оно сохраняется в файл.',
'screenshot.button': 'Скопировать пост как изображение',
'screenshot.copying': 'Копирование…',
'screenshot.copied': 'Пост скопирован в буфер обмена',
'screenshot.saved': 'Не удалось скопировать изображение — сохранено в файл',
'screenshot.captureFailed': 'Не удалось создать скриншот',
```

```js
// zh
'screenshot.title': '截图',
'screenshot.sectionMain': '截图',
'screenshot.sectionMainDesc': '将帖子以 PNG 图片复制到剪贴板。',
'screenshot.enabled': '启用帖子截图',
'screenshot.enabledHint': '在帖子顶部添加相机按钮。图片会复制到剪贴板；如果浏览器无法复制图片，则会保存为文件。',
'screenshot.button': '将帖子复制为图片',
'screenshot.copying': '正在复制…',
'screenshot.copied': '帖子已复制到剪贴板',
'screenshot.saved': '无法复制图片 — 已保存为文件',
'screenshot.captureFailed': '无法创建截图',
```

```js
// es
'screenshot.title': 'Captura',
'screenshot.sectionMain': 'Captura',
'screenshot.sectionMainDesc': 'Copiar una publicación como imagen PNG al portapapeles.',
'screenshot.enabled': 'Activar capturas de publicaciones',
'screenshot.enabledHint': 'Añade un botón de cámara a la cabecera de la publicación. La imagen se copia al portapapeles; si el navegador no puede copiar imágenes, se guarda como archivo.',
'screenshot.button': 'Copiar publicación como imagen',
'screenshot.copying': 'Copiando…',
'screenshot.copied': 'Publicación copiada al portapapeles',
'screenshot.saved': 'No se pudo copiar la imagen — se guardó como archivo',
'screenshot.captureFailed': 'No se pudo crear la captura',
```

```js
// pt
'screenshot.title': 'Captura',
'screenshot.sectionMain': 'Captura',
'screenshot.sectionMainDesc': 'Copiar um post como imagem PNG para a área de transferência.',
'screenshot.enabled': 'Ativar capturas de posts',
'screenshot.enabledHint': 'Adiciona um botão de câmera ao cabeçalho do post. A imagem é copiada para a área de transferência; se o navegador não puder copiar imagens, ela é salva como arquivo.',
'screenshot.button': 'Copiar post como imagem',
'screenshot.copying': 'Copiando…',
'screenshot.copied': 'Post copiado para a área de transferência',
'screenshot.saved': 'Não foi possível copiar a imagem — salva como arquivo',
'screenshot.captureFailed': 'Não foi possível criar a captura',
```

```js
// de
'screenshot.title': 'Screenshot',
'screenshot.sectionMain': 'Screenshot',
'screenshot.sectionMainDesc': 'Einen Beitrag als PNG-Bild in die Zwischenablage kopieren.',
'screenshot.enabled': 'Beitrags-Screenshots aktivieren',
'screenshot.enabledHint': 'Fügt der Beitragskopfzeile eine Kamera-Schaltfläche hinzu. Das Bild wird in die Zwischenablage kopiert; wenn der Browser keine Bilder kopieren kann, wird es als Datei gespeichert.',
'screenshot.button': 'Beitrag als Bild kopieren',
'screenshot.copying': 'Wird kopiert…',
'screenshot.copied': 'Beitrag in die Zwischenablage kopiert',
'screenshot.saved': 'Bild konnte nicht kopiert werden — als Datei gespeichert',
'screenshot.captureFailed': 'Screenshot konnte nicht erstellt werden',
```

```js
// fr
'screenshot.title': 'Capture',
'screenshot.sectionMain': 'Capture',
'screenshot.sectionMainDesc': 'Copier une publication en image PNG dans le presse-papiers.',
'screenshot.enabled': 'Activer les captures de publications',
'screenshot.enabledHint': 'Ajoute un bouton appareil photo à l’en-tête de la publication. L’image est copiée dans le presse-papiers ; si le navigateur ne peut pas copier d’images, elle est enregistrée dans un fichier.',
'screenshot.button': 'Copier la publication en image',
'screenshot.copying': 'Copie…',
'screenshot.copied': 'Publication copiée dans le presse-papiers',
'screenshot.saved': 'Impossible de copier l’image — enregistrée dans un fichier',
'screenshot.captureFailed': 'Impossible de créer la capture',
```

```js
// ja
'screenshot.title': 'スクリーンショット',
'screenshot.sectionMain': 'スクリーンショット',
'screenshot.sectionMainDesc': '投稿を PNG 画像としてクリップボードにコピーします。',
'screenshot.enabled': '投稿のスクリーンショットを有効にする',
'screenshot.enabledHint': '投稿のヘッダーにカメラボタンを追加します。画像はクリップボードにコピーされ、ブラウザが画像のコピーに対応していない場合はファイルとして保存されます。',
'screenshot.button': '投稿を画像としてコピー',
'screenshot.copying': 'コピー中…',
'screenshot.copied': '投稿をクリップボードにコピーしました',
'screenshot.saved': '画像をコピーできませんでした — ファイルとして保存しました',
'screenshot.captureFailed': 'スクリーンショットを作成できませんでした',
```

- [ ] **Step 6: Verify the shell**

Run: `npm run check:i18n && npm run build`
Expected: i18n passes with no missing keys, build succeeds, artifacts refresh.

Manual harness check (`npm run harness`): the settings dialog lists a
**Screenshot** tab, the switch is **off**, and no button exists in any post.

---

### Task 3: Header button, capture and download fallback

**Files:**
- Create: `src/features/screenshot/button.js` (replace the stub)
- Create: `src/features/screenshot/capture.js`
- Create: `src/features/screenshot/copy.js`
- Modify: `src/features/screenshot/index.js` (no change expected if the stub exports match)
- Modify: `src/features/translate/placement.js`
- Modify: `src/features/translate/controller.js`
- Modify: `package.json` (via `npm install modern-screenshot`)

**Interfaces:**
- Consumes: `findHeaderActionsSlot(slotSource)`, `mountHeaderButton(slot, btn, inQuote)` from `translate/placement.js`; `setButtonLabel`, `isLoading` from `ui/action-button.js`; `saveBlob` from `utils/download.js`; `el`, `silencePointerEvents` from `utils/dom.js`; `SEL`, `UI_ATTR` from `core/constants.js`; `handleFromHref` from `utils/handle.js`; `domToBlob` from `modern-screenshot`.
- Produces:
  - `button.js`: `scanButtons(): void`, `removeAllButtons(): void`.
  - `capture.js`: `capturePost(article: HTMLElement): Promise<Blob>`.
  - `copy.js`: `copyPost(article: HTMLElement, btn: HTMLButtonElement): Promise<void>` (Task 3 delivers the download path; Task 4 adds clipboard).

- [ ] **Step 1: Install the renderer**

Run: `npm install modern-screenshot`
Expected: `package.json` gains `"dependencies": { "modern-screenshot": "^4.7.0" }`;
no `@require` is added to the userscript metadata.

- [ ] **Step 2: Export the header-slot finder**

In `src/features/translate/placement.js`, change
`function findHeaderActionsSlot(postEl)` to `export function findHeaderActionsSlot(postEl)`.
No other change.

- [ ] **Step 3: Stop translate teardown from deleting other features' controls**

In `src/features/translate/controller.js`, `teardownAllPosts()` currently ends
with one sweep over `[data-xp-toolbar], .xp-header-action`. Replace that sweep
with:

```js
document.querySelectorAll(`[${ATTR.toolbar}]`).forEach((node) => node.remove());
document.querySelectorAll('.xp-header-action').forEach((node) => {
  if (node.querySelector(`[${ATTR.button}]`) || !node.firstElementChild) node.remove();
});
```

- [ ] **Step 4: Implement button creation, placement and teardown**

`src/features/screenshot/button.js`:

```js
import { SEL, UI_ATTR } from '../../core/constants.js';
import { isLoading, setButtonLabel } from '../../ui/action-button.js';
import { el, silencePointerEvents } from '../../utils/dom.js';
import { findHeaderActionsSlot, mountHeaderButton } from '../translate/placement.js';
import { ATTR, cfg, ss } from './config.js';
import { copyPost } from './copy.js';

export function scanButtons(): void
export function removeAllButtons(): void
```

Behavior:

- `scanButtons()` returns immediately when `!cfg().enabled`. Otherwise it walks
  `document.querySelectorAll(SEL.article)`, skips articles inside
  `[data-xp-ui]` or inside another `SEL.article`, and calls `ensureButton`.
- `ensureButton(article)` reuses `article.querySelector('[data-xp-shot-btn]')`
  or creates `el('button', 'xp-btn xp-btn--header xp-shot-btn')`, sets
  `type="button"`, `ATTR.button`, and `setButtonLabel(btn, ss('button'), { glyph: 'camera' })`.
- Placement: `findHeaderActionsSlot(article)`; if null, leave the button
  unmounted (retried next scan). Otherwise `mountHeaderButton(slot, btn, false)`,
  set `ATTR.action` on `btn.closest('.xp-header-action')`, and if the row holds
  a `.xp-header-action` containing `[data-xp-btn]` (Translate), move our wrap
  directly after it with `insertAdjacentElement('afterend', wrap)`.
- Binding: once per button (`dataset.xpBound`), `silencePointerEvents(btn)`, a
  capture-phase `click` listener that calls `preventDefault()`,
  `stopPropagation()`, ignores `isLoading(btn)` and calls `copyPost(article, btn)`.
- `removeAllButtons()` removes `[data-xp-shot-action]` wrappers, then any stray
  `[data-xp-shot-btn]`.

- [ ] **Step 5: Implement the capture pipeline**

`src/features/screenshot/capture.js`:

```js
import { domToBlob } from 'modern-screenshot';
import { Codes, fail } from '../../core/debug.js';
import {
  CAPTURE_TIMEOUT_MS,
  MAX_CANVAS_SIZE,
  SCALE_MAX,
  SCALE_MIN,
} from './config.js';

export async function capturePost(article): Promise<Blob>
```

Behavior:

- `backgroundColor`: walk from `article` up through ancestors, return the first
  computed `backgroundColor` that is neither `transparent` nor
  `rgba(0, 0, 0, 0)`; fall back to `getComputedStyle(document.body).backgroundColor`.
- `scale`: `Math.min(SCALE_MAX, Math.max(SCALE_MIN, window.devicePixelRatio || 1))`.
- Options: `{ scale, maximumCanvasSize: MAX_CANVAS_SIZE, timeout: CAPTURE_TIMEOUT_MS,
  backgroundColor, filter, onCloneEachNode, features: { restoreScrollPosition: false } }`.
- `filter(node)`: keep everything except `node instanceof Element && node.matches('[data-xp-ui]')`.
- `onCloneEachNode(cloned)`: for `VIDEO` elements, build an `IMG` with the same
  `className`, `src = cloned.getAttribute('poster') || ''`,
  `style.width/height = '100%'`, `objectFit = 'cover'`, `display = 'block'`;
  when there is no poster, use a `DIV` with the same className, the same
  100% sizing and `background: rgb(39, 44, 48)`. Replace the clone.
- Wrap a render rejection in `fail(Codes.SCREENSHOT_FAILED, 'post screenshot failed', { handle }, error)`,
  where `handle` comes from the article's `User-Name` links via `handleFromHref`.

- [ ] **Step 6: Implement the click flow with a download fallback (no clipboard yet)**

`src/features/screenshot/copy.js`:

```js
import { Codes, logWarn } from '../../core/debug.js';
import { showToast } from '../../ui/toast.js';
import { saveBlob } from '../../utils/download.js';
import { handleFromHref } from '../../utils/handle.js';
import { setButtonLabel } from '../../ui/action-button.js';
import { capturePost } from './capture.js';
import { ss } from './config.js';

export async function copyPost(article, btn): Promise<void>
```

Behavior:

- Set the loading label `ss('copying')`, then `const blobPromise = capturePost(article)`
  and attach `blobPromise.catch(() => {})` so a rejection is never unhandled.
- Await the blob, `saveBlob(blob, fileName(article))`, show
  `showToast(ss('saved'), { type: 'warning' })`.
- On failure: `logWarn(Codes.SCREENSHOT_FAILED, 'post screenshot failed', { error })`
  and `showToast(ss('captureFailed'), { type: 'error' })`.
- `finally`: restore `setButtonLabel(btn, ss('button'), { glyph: 'camera' })`.
- `fileName(article)`: `x-plus-post-<handle>-<id>.png`, where `handle` is the
  first `[data-testid="User-Name"] a[href^="/"]` passed through
  `handleFromHref` (fallback `'post'`) and `id` is the first `/status/<digits>`
  match in the article, fallback `Date.now()`.
- Selectors for the file name live at the top of this module.

- [ ] **Step 7: Verify the download path**

Run: `npm run check:syntax && npm run build`
Expected: build succeeds.

Harness: open the settings, enable **Screenshot**, close the dialog. Every post
gets a camera button after the (also enabled) Translate button. Click it: a PNG
named `x-plus-post-<handle>-<id>.png` is saved. Toggle Translate off in its tab:
the camera button stays and re-mounts after a rescan. Toggle Screenshot off:
every camera button disappears.

---

### Task 4: Clipboard delivery

**Files:**
- Modify: `src/features/screenshot/copy.js`

**Interfaces:**
- Consumes: the Task 3 `copyPost`, `capturePost`, `saveBlob`, `showToast`.
- Produces: the final `copyPost` behavior.

- [ ] **Step 1: Add the clipboard fast path**

In `copyPost`, after starting `blobPromise`, use the clipboard when available:

```js
const canCopy =
  typeof ClipboardItem !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';

if (canCopy) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
    showToast(ss('copied'), { type: 'success' });
    return;
  } catch {
    /* fall through to the file */
  }
}

const blob = await blobPromise;
saveBlob(blob, fileName(article));
showToast(ss('saved'), { type: 'warning' });
```

Capture failures still take the error branch (`captureFailed` toast +
`XP-1501`). The `finally` label reset stays. The promise is passed to
`ClipboardItem` synchronously inside the click handler, so the user gesture is
not lost to the async render.

- [ ] **Step 2: Verify copy and fallback**

Run: `npm run check:syntax && npm run build`
Expected: build succeeds.

Harness in Chrome: click the camera button → success toast; paste into an image
editor and confirm the post. In Firefox (or with clipboard permission denied):
the same click saves a PNG and shows the warning toast; the console has no
unhandled rejection.

---

### Task 5: Docs and final verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-11-15-post-screenshot-design.md` (drop the unused `copyFailed` key from the i18n list)

**Interfaces:**
- Consumes: everything above.
- Produces: user- and developer-facing documentation.

- [ ] **Step 1: Document the feature**

In `docs/ARCHITECTURE.md`, add `features/screenshot/` to the repository layout
and a `### screenshot` section: the button placement, the capture pipeline
(`modern-screenshot`, `[data-xp-ui]` stripped, video → poster), the clipboard
promise trick and the download fallback, and the file roles
(`index.js` / `config.js` / `button.js` / `capture.js` / `copy.js`).

In `README.md`, add one bullet where post tools are listed: copy a post as a
PNG image to the clipboard from a camera button in its header (off by default).

In `CHANGELOG.md`, under `[Unreleased] → Added`, add one bullet: post
screenshots copied to the clipboard from a header button, off by default.

- [ ] **Step 2: Final verification**

Run: `npm run ci`
Expected: syntax check, i18n, unit tests, production build and artifact
verification all pass; `x-plus.user.js` / `x-plus.meta.js` are refreshed.

- [ ] **Step 3: Review the diff**

Run: `git status --short && git diff --stat`
Expected: only the files listed in this plan plus the two generated artifacts.
Do not commit unless the owner asks.
