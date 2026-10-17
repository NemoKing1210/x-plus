/** `{name}` placeholder substitution for plain strings. */
export function fmt(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key]),
  );
}

export function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatBitrate(bitsPerSecond) {
  const bps = Number(bitsPerSecond) || 0;
  if (!bps) return '';
  return `${(bps / 1_000_000).toFixed(bps >= 1_000_000 ? 1 : 2)} Mbps`;
}

/** Make a string safe for use as a file name (all platforms). */
export function sanitizeFileName(name, maxLength = 120) {
  const cleaned = String(name || '')
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, maxLength)
    .trim();
  return cleaned || 'file';
}
