/**
 * Local harness for X Plus: serves a mock x.com page (dev/harness/index.html)
 * with GM_* shims and the built userscript from dist/. `/proxy` stands in for
 * GM_xmlhttpRequest (server-side fetch, so no CORS). Run `npm run build` first.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const PORT = 5179;

/** Canned syndication response for the three-photo fixture post (id 123456). */
const PHOTO_TWEET = {
  __typename: 'Tweet',
  id_str: '123456',
  text: 'Three photos for the gallery.',
  created_at: '2026-05-05T12:00:00.000Z',
  user: { screen_name: 'nasa', name: 'NASA' },
  mediaDetails: ['AAA111', 'BBB222', 'CCC333'].map((name) => ({
    type: 'photo',
    media_url_https: `http://localhost:${PORT}/pbs.twimg.com/media/${name}.jpg?name=orig`,
    original_info: { width: 300, height: 198 },
  })),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/legacy') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(readFileSync(join(here, 'index.html')));
    return;
  }
  if (
    url.pathname === '/modern' ||
    url.pathname === '/modern.html' ||
    // The modern fixture is the home timeline: serve it on the real path too, so
    // the rules that are home-only (`feed tabs`) can be exercised.
    url.pathname === '/home' ||
    url.pathname.startsWith('/home/')
  ) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(readFileSync(join(here, 'modern.html')));
    return;
  }
  if (url.pathname === '/report.js') {
    res.setHeader('content-type', 'application/javascript; charset=utf-8');
    res.end(readFileSync(join(here, 'report.js')));
    return;
  }
  // Fake pbs.twimg.com photo: an SVG showing the requested rendition.
  if (url.pathname.startsWith('/pbs.twimg.com/media/')) {
    const id = url.pathname.split('/').pop();
    const name = url.searchParams.get('name') || 'default';
    const size = { small: 680, large: 1600, orig: 3200 }[name] || 400;
    const hue = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
    res.setHeader('content-type', 'image/svg+xml');
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 0.66)}" viewBox="0 0 300 198"><defs><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.25)"/></pattern></defs><rect width="300" height="198" fill="hsl(${hue} 60% 40%)"/><rect width="300" height="198" fill="url(#p)"/><text x="150" y="100" fill="#fff" font-size="22" text-anchor="middle" font-family="sans-serif">${id} · ${name}</text></svg>`);
    return;
  }
  if (url.pathname === '/shims.js') {
    res.setHeader('content-type', 'application/javascript; charset=utf-8');
    res.end(readFileSync(join(here, 'shims.js')));
    return;
  }
  // Any /<user>/status/<id> path serves the article fixture.
  if (/^\/[^/]+\/(status|article)\//.test(url.pathname)) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(readFileSync(join(here, 'article.html')));
    return;
  }
  if (url.pathname === '/x-plus.user.js') {
    res.setHeader('content-type', 'application/javascript; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(readFileSync(join(root, 'dist', 'x-plus.user.js')));
    return;
  }
  // Stand-in for GM_xmlhttpRequest: forwards the request server-side (no CORS).
  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('url');
    // The photo fixture post has a fake id: answer the media resolution locally
    // so the Save / Copy flow can be exercised without a real tweet.
    try {
      const upstream = new URL(target);
      if (
        upstream.hostname === 'cdn.syndication.twimg.com' &&
        upstream.pathname === '/tweet-result' &&
        upstream.searchParams.get('id') === PHOTO_TWEET.id_str
      ) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(PHOTO_TWEET));
        return;
      }
    } catch {
      /* malformed target: let the generic proxy report it */
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(target, {
        method: req.method,
        headers: { 'user-agent': 'Mozilla/5.0' },
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      res.statusCode = upstream.status;
      res.setHeader('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      res.statusCode = 502;
      res.end(String(error));
    }
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, () => console.log(`harness on http://localhost:${PORT}`));
