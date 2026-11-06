import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// The only intentional HTML injection sink in the XSS challenge.
// Keep this script separate from the shop bundle and all privileged services.
export const previewScript = `window.alert = (message) => parent.postMessage({ type: 'xss-preview-alert', message: String(message) }, '*');
const search = new URLSearchParams(location.search).get('search') || '';
document.getElementById('result').innerHTML = 'No products found for: ' + search;`;

const scriptHash = createHash('sha256').update(previewScript).digest('base64');
export const previewHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dice &amp; Lore search results</title>
<style>
:root{color-scheme:dark;font-family:"Segoe UI",sans-serif;color:#f5f5f5;background:#0e0e0e}
*{box-sizing:border-box}body{margin:0;padding:28px;text-align:center;overflow-wrap:anywhere}
h1{font-size:24px;font-weight:500}p{color:#a3a3a3;line-height:1.7}
#result{line-height:1.8}#result h2{color:#a78bfa}
</style></head><body>
<h1>No treasures found</h1>
<div id="result"></div>
<p>Try another search or explore a different category.</p>
<script>${previewScript}</script>
</body></html>`;

export function createPreviewServer({
  shopOrigins = process.env.XSS_SHOP_ORIGINS || 'http://localhost:8080 http://localhost:5173 http://localhost:3001',
} = {}) {
  const ancestors = shopOrigins.split(/\s+/).filter(Boolean).map((value) => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
      throw new Error('XSS_SHOP_ORIGINS must contain space-separated HTTP(S) origins.');
    }
    return url.origin;
  });
  if (!ancestors.length) throw new Error('At least one shop origin is required.');
  const csp = [
    "default-src 'none'",
    "sandbox allow-scripts",
    `script-src 'sha256-${scriptHash}'`,
    // Deliberately permit event handlers, but not arbitrary script elements,
    // remote scripts, eval, fetch, images, nested frames or form submissions.
    "script-src-attr 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "connect-src 'none'", "img-src 'none'", "font-src 'none'",
    "media-src 'none'", "frame-src 'none'", "worker-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'",
    `frame-ancestors ${ancestors.join(' ')}`,
  ].join('; ');
  const server = createServer({ maxHeaderSize: 16384 }, (req, res) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }
    const url = new URL(req.url, 'http://preview.invalid');
    if (url.pathname !== '/') {
      res.writeHead(404);
      return res.end();
    }
    const search = url.searchParams.get('search') || '';
    if (search.length > 4096) {
      res.writeHead(414);
      return res.end('Search text is too long.');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : previewHtml);
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createPreviewServer().listen(Number(process.env.XSS_PREVIEW_PORT || 8081), '0.0.0.0', () => {
    console.log('Isolated Dice & Lore search preview listening.');
  });
}
