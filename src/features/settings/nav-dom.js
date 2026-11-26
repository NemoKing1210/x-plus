import { navLabelWeight } from '../../core/compat/index.js';
import { iconPath } from '../../ui/icons.js';

/**
 * DOM touches for the injected "X Plus" row. Kept apart from `nav-button.js`
 * (which pulls in settings and GM storage) so they can be unit-tested.
 */

/**
 * The label node of a cloned nav row. The legacy row keeps the text in a
 * `div[dir]` span; the modern row nests it inside the pill next to the icon,
 * so the pill must never be used: writing to it would wipe the icon.
 * @returns {Element | null} the node that now carries the label
 */
export function applyNavLabel(root, text) {
  const marked = root.querySelector?.('[data-xp-nav-label]');
  if (marked) {
    marked.textContent = text;
    return marked;
  }

  const labelDiv = [...root.querySelectorAll('div[dir]')].find(
    (node) => node.querySelector(':scope > span') && !node.querySelector('svg'),
  );
  const target =
    (labelDiv && labelDiv.querySelector(':scope > span')) ||
    [...root.querySelectorAll('span')].find(
      (span) => !span.querySelector?.('svg, img') && span.children?.length === 0 && span.textContent?.trim(),
    );
  if (!target) return null;
  target.textContent = text;
  target.setAttribute('data-xp-nav-label', '1');
  return target;
}

/**
 * Swap the glyph of every icon state in the row. The modern row keeps two
 * stacked `<svg>`s (idle / active) and cross-fades them, so replacing only
 * the first would leave the other row's glyph showing on hover.
 */
export function applyNavIcon(root) {
  for (const svg of root.querySelectorAll('svg')) {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.innerHTML = `<g><path d="${iconPath('plus')}"></path></g>`;
  }
}

/**
 * Whether our row must be cloned again. A row built before the modern label
 * fix carries our mark on the pill that also holds the icon: rebuild it rather
 * than keep the flattened label.
 */
export function navRowNeedsRebuild(btn) {
  const label = btn.querySelector?.('[data-xp-nav-label]');
  // Rows built before the pill fix lost their icon entirely: clone again.
  if (!btn.querySelector?.('svg')) return true;
  if (btn.dataset?.xpNavOk === '1') return Boolean(label && label.children?.length > 0);
  if (!label) return true;
  // Cloned from the active row → bold label; rebuild from an inactive one.
  const weight = navLabelWeight(btn);
  if (weight != null && weight >= 600) return true;
  if (btn.dataset) btn.dataset.xpNavOk = '1';
  return false;
}
