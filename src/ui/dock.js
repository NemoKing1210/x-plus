import { el } from '../utils/dom.js';

/**
 * Small fixed bar in the bottom left corner that hosts our quick controls (the
 * shortcut reminder, the Shorts switch). Items hide themselves with `hidden`;
 * `syncDock()` hides the bar when nothing is left in it.
 */

let dock = null;

export function getDock() {
  if (dock?.isConnected) return dock;
  dock = el('div', 'xp-dock');
  (document.body || document.documentElement).appendChild(dock);
  return dock;
}

export function syncDock() {
  if (!dock) return;
  dock.hidden = ![...dock.children].some((node) => !node.hidden);
}
