import { createHash } from 'node:crypto';

// The only intentional HTML injection sink in the XSS challenge.
// Keep this script separate from the shop bundle and all privileged services.
export const previewScript = `const nativeAlert = window.alert.bind(window);
window.alert = (message) => {
  parent.postMessage({ type: 'dice-lore-xss-alert' }, '*');
  nativeAlert(message);
};
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


// A fixed document only: never interpolate request headers, cookies or query data.
export const previewCsp = [
  "default-src 'none'", "sandbox allow-scripts allow-modals",
  `script-src 'sha256-${scriptHash}'`, "script-src-attr 'unsafe-inline'",
  "style-src 'unsafe-inline'", "connect-src 'none'", "img-src 'none'",
  "font-src 'none'", "media-src 'none'", "frame-src 'none'", "worker-src 'none'",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'",
].join('; ');

export function serveXssPreview(req, res) {
  res.set({
    'Content-Security-Policy': previewCsp,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  });
  if (!['GET', 'HEAD'].includes(req.method)) return res.set('Allow', 'GET, HEAD').status(405).end();
  const url = new URL(req.originalUrl, 'http://preview.invalid');
  if (url.pathname !== '/xss-preview/') return res.status(404).end();
  if ((url.searchParams.get('search') || '').length > 4096) return res.status(414).end('Search text is too long.');
  res.type('html').send(previewHtml);
}
