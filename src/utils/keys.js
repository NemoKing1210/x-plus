/** Readable name of a `KeyboardEvent.code` (`KeyP` → `P`, `Digit1` → `1`, `ArrowUp` → `↑`). */

const NAMES = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'Space',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export function keyLabel(code) {
  if (!code) return '';
  if (NAMES[code]) return NAMES[code];
  const letter = /^(?:Key|Digit)(.+)$/.exec(code);
  if (letter) return letter[1];
  return code.replace(/^Numpad/, 'Num ');
}

/** Tooltip text with its hotkey: `Next post (J)`; the label alone when no key is set. */
export function keyHint(label, code) {
  const key = keyLabel(code);
  return key ? `${label} (${key})` : label;
}
