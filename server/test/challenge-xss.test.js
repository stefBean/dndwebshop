import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { createPreviewServer, previewScript } from '../../challenge-xss/server.mjs';
import { createApp } from '../app.js';
import { openDatabase } from '../db.js';

async function serve(t, server) {
  server = server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return 'http://127.0.0.1:' + server.address().port;
}

test('preview is static: URL input is decoded only by the isolated browser script', async (t) => {
  const base = await serve(t, createPreviewServer());
  const payload = '<svg onload="document.body.dataset.xss=1"></svg>&+# ä';
  const url = new URL(base);
  url.searchParams.set('search', payload);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(!html.includes(payload));
  assert.ok(html.includes(previewScript));
  const result = {};
  runInNewContext(previewScript, {
    window: {}, URLSearchParams, location: { search: url.search },
    document: { getElementById: (id) => { assert.equal(id, 'result'); return result; } },
  });
  assert.equal(result.innerHTML, 'No products found for: ' + payload);
  // This checks the source-to-sink flow, not browser execution; see manual scenario.
});

test('preview headers restrict scripts, resources, framing and direct-open privileges', async (t) => {
  const base = await serve(t, createPreviewServer());
  const response = await fetch(base);
  const csp = response.headers.get('content-security-policy');
  const hash = createHash('sha256').update(previewScript).digest('base64');
  assert.ok(csp.includes("script-src 'sha256-" + hash + "'"));
  for (const directive of [
    "sandbox allow-scripts", "script-src-attr 'unsafe-inline'",
    "default-src 'none'", "connect-src 'none'", "img-src 'none'",
    "frame-src 'none'", "worker-src 'none'", "form-action 'none'", "base-uri 'none'",
    "frame-ancestors http://localhost:8080",
  ]) assert.ok(csp.includes(directive), directive);
  assert.ok(!csp.includes('allow-same-origin'));
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await fetch(base + '/api/auth/me')).status, 404);
  assert.equal((await fetch(base, { method: 'POST', body: 'ignored' })).status, 405);
  assert.equal((await fetch(base + '/?search=' + 'x'.repeat(4097))).status, 414);
});

test('shop exposes only the fixed preview origin and preserves its script policy', async (t) => {
  const db = openDatabase(':memory:', { demoAccounts: false });
  t.after(() => db.close());
  const base = await serve(t, createApp(db, { xssPreviewOrigin: 'http://127.0.0.1:8081' }));
  const response = await fetch(base + '/api/challenges/xss/config?previewOrigin=https://evil.invalid');
  assert.deepEqual(await response.json(), { isActive: false, previewOrigin: 'http://127.0.0.1:8081' });
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp.includes("script-src 'self';"));
  assert.ok(csp.includes("frame-src http://127.0.0.1:8081;"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.equal((await fetch(base + '/api/products?search=Dragon%20Sword')).status, 200);
  assert.throws(() => createApp(db, { xssPreviewOrigin: 'javascript:alert(1)' }));
});

test('integration confines the sink and remounts the sandbox when the search changes', async () => {
  const frame = await readFile(new URL('../../client/src/components/catalog/SearchChallengeFrame.jsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../../client/src/pages/ShopPage.jsx', import.meta.url), 'utf8');
  assert.ok(frame.includes('sandbox="allow-scripts"'));
  assert.ok(frame.includes('key={url.href}'));
  assert.ok(frame.includes('url.searchParams.set("search", search)'));
  assert.ok(!frame.includes('dangerouslySetInnerHTML'));
  assert.ok(!page.includes('dangerouslySetInnerHTML'));
  assert.ok(page.includes(') : search.trim() ? ('));
  assert.ok(!page.includes('{search.trim() && ('));
  assert.ok(page.indexOf(') : filtered.length ? (') < page.indexOf(') : search.trim() ? ('));
  assert.ok(page.includes('onReset={() => setSearch("")}'));
});

test('XSS activation follows live challenge state in development and production', async (t) => {
  const db = openDatabase(':memory:', { demoAccounts: false });
  t.after(() => db.close());
  const base = await serve(t, createApp(db, { production: false }));
  const active = async () => (await (await fetch(base + '/api/challenges/xss/config')).json()).isActive;
  assert.equal(await active(), false);
  db.prepare("UPDATE challenges SET active = 1 WHERE id = 'xss'").run();
  assert.equal(await active(), true);
  const production = await serve(t, createApp(db, { production: true }));
  assert.equal((await (await fetch(production + '/api/challenges/xss/config')).json()).isActive, true);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'xss'").run();
  assert.equal(await active(), false);
});

test('preview relays alert messages to its embedding window', () => {
  const messages = [];
  const context = { window: {}, URLSearchParams, location: { search: '' },
    document: { getElementById: () => ({}) },
    parent: { postMessage: (...args) => messages.push(args) } };
  runInNewContext(previewScript, context);
  context.window.alert('challenge code');
  assert.equal(messages[0][0].type, 'xss-preview-alert');
  assert.equal(messages[0][0].message, 'challenge code');
});
