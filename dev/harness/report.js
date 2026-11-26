/**
 * Harness-only compat panel: renders `window.__xpCompat.report()` plus a few
 * self-checks. Loaded by `dev/harness/modern.html` after the userscript; it is
 * never part of the built script (the production bundle has no entry for it).
 */

window.addEventListener('load', () => {
  const panel = document.getElementById('xp-compat-report');
  if (!panel) return;

  /** @returns {string} one `ok` / `FAIL` line per check. */
  const selfTest = (compat) => {
    const html = document.documentElement;
    const report = compat?.report() ?? null;
    const rows = [
      ['userscript exposed window.__xpCompat', Boolean(compat)],
      ['generation detected', Boolean(compat) && compat.generation() !== 'unknown'],
      ['data-xp-dom matches the report', Boolean(report) && html.getAttribute('data-xp-dom') === report.generation],
      ['no profile errors', Boolean(report) && report.errors.length === 0],
    ];
    return rows.map(([name, ok]) => `${ok ? 'ok  ' : 'FAIL'} ${name}`).join('\n');
  };

  const render = () => {
    const compat = window.__xpCompat;
    if (!compat) {
      panel.textContent = 'no window.__xpCompat — is xp_debug / __XP_DEBUG__ on?';
      return;
    }
    panel.textContent = `${JSON.stringify(compat.report(), null, 2)}\n\n${selfTest(compat)}`;
  };

  panel.addEventListener('click', render);
  let tries = 0;
  const tick = () => {
    render();
    if (window.__xpCompat?.generation() === 'unknown' && tries++ < 20) setTimeout(tick, 250);
  };
  tick();
});
