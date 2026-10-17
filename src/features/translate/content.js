import { extractLinkedText, hasTranslatablePlainText } from '../../utils/linked-text.js';
import { ATTR } from './config.js';

/** Clone of post text with our chrome stripped (uses stored original when replaced). */
export function clonePostContent(el) {
  const stored = el.getAttribute(ATTR.originalHtml);
  if (stored != null) {
    const tmp = document.createElement('div');
    tmp.innerHTML = stored;
    return tmp;
  }

  const clone = el.cloneNode(true);
  clone
    .querySelectorAll(`[${ATTR.toolbar}], [${ATTR.button}], [${ATTR.result}]`)
    .forEach((node) => node.remove());
  return clone;
}

/** Plain text for translate APIs, with anchors turned into stable tokens. */
export function extractPostForTranslate(el) {
  return extractLinkedText(clonePostContent(el));
}

export function postHasTranslatableContent(el) {
  const { text } = extractPostForTranslate(el);
  return hasTranslatablePlainText(text);
}
