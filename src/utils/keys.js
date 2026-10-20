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
