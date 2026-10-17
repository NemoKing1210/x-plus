import { GM_xmlhttpRequest } from '$';

/**
 * Promise wrapper over GM_xmlhttpRequest (cross-origin, bypasses CORS).
 *
 * @param {object} options
 * @param {string} options.url
 * @param {'GET'|'POST'} [options.method]
 * @param {Record<string,string>} [options.headers]
 * @param {'json'|'text'|'blob'|'arraybuffer'} [options.responseType]
 * @param {number} [options.timeout]
 * @param {boolean} [options.anonymous] - do not send cookies
 * @param {boolean} [options.allow404] - resolve `null` on 404
 * @param {unknown} [options.data]
 * @param {(event: {loaded:number,total:number}) => void} [options.onProgress]
 * @param {(abort: () => void) => void} [options.onAbort] - receives the abort handle
 */
export function gmRequest(options) {
  return new Promise((resolve, reject) => {
    const type = options.responseType || 'json';
    const request = {
      method: options.method || 'GET',
      url: options.url,
      headers: options.headers || {},
      responseType: type,
      timeout: options.timeout || 20000,
      onload(res) {
        if (options.allow404 && res.status === 404) {
          resolve(null);
          return;
        }
        if (res.status < 200 || res.status >= 300) {
          const error = new Error(`HTTP ${res.status}`);
          error.status = res.status;
          error.body = typeof res.responseText === 'string' ? res.responseText : '';
          reject(error);
          return;
        }
        if (type === 'text') {
          resolve(
            res.responseText != null && res.responseText !== ''
              ? res.responseText
              : res.response,
          );
        } else if (type === 'json') {
          if (res.response != null && typeof res.response === 'object') {
            resolve(res.response);
            return;
          }
          const raw = res.responseText;
          if (typeof raw === 'string' && raw.trim()) {
            try {
              resolve(JSON.parse(raw));
              return;
            } catch {
              /* fall through */
            }
          }
          resolve(res.response);
        } else {
          resolve(res.response);
        }
      },
      onerror: () => reject(new Error('Network error')),
      ontimeout: () => reject(new Error('Timeout')),
      onabort: () => reject(new Error('Aborted')),
    };
    if (typeof options.anonymous === 'boolean') request.anonymous = options.anonymous;
    if (typeof options.onProgress === 'function') {
      request.onprogress = (event) =>
        options.onProgress({ loaded: event.loaded || 0, total: event.total || 0 });
    }
    if (options.data != null) {
      request.data =
        typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
    }
    const handle = GM_xmlhttpRequest(request);
    if (typeof options.onAbort === 'function' && handle?.abort) {
      options.onAbort(() => handle.abort());
    }
  });
}
