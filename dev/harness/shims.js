// ── GM_* shims ─────────────────────────────────────────────────────────
  window.__store = JSON.parse(localStorage.getItem('__gm') || '{}');
  window.GM_getValue = (k, d) => (k in window.__store ? JSON.parse(JSON.stringify(window.__store[k])) : d);
  window.GM_setValue = (k, v) => { window.__store[k] = JSON.parse(JSON.stringify(v)); localStorage.setItem('__gm', JSON.stringify(window.__store)); };
  window.GM_registerMenuCommand = (name) => console.log('menu command:', name);
  window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); return s; };
  window.GM_xmlhttpRequest = (d) => {
    const ctrl = new AbortController();
    const headers = {};
    for (const [k, v] of Object.entries(d.headers || {})) if (!/^(user-agent|origin|referer)$/i.test(k)) headers[k] = v;
    fetch('/proxy?url=' + encodeURIComponent(d.url), { method: d.method || 'GET', headers, body: d.data, signal: ctrl.signal })
      .then(async (r) => {
        const type = d.responseType;
        let response; let responseText = '';
        if (type === 'blob') response = await r.blob();
        else if (type === 'arraybuffer') response = await r.arrayBuffer();
        else { responseText = await r.text(); response = type === 'json' ? JSON.parse(responseText) : responseText; }
        d.onprogress?.({ loaded: response.size || 1, total: response.size || 1 });
        d.onload?.({ status: r.status, response, responseText });
      })
      .catch((e) => (e.name === 'AbortError' ? d.onabort?.() : d.onerror?.(e)));
    return { abort: () => ctrl.abort() };
  };
