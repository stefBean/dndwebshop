import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createApp } from '../app.js';
import { openDatabase, initializeDatabase } from '../db.js';

const password = 'RollForAdventure!24';

async function fixture(t, { filename = ':memory:', demoAccounts = true, production = false, challengeOptions, activeChallenges = [] } = {}) {
  const db = openDatabase(filename, { demoAccounts });
  for (const id of activeChallenges) db.prepare('UPDATE challenges SET active = 1 WHERE id = ?').run(id);
  const server = createApp(db, { production, challengeOptions }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const request = (url, { cookie, body, rawBody, headers, ...options } = {}) => fetch(base + url, {
    ...options,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(rawBody !== undefined ? { body: rawBody } : body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async (username = 'admin') => {
    const response = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  return { db, request, login };
}

test('catalog has full data, consistent details, safe search and useful missing-product errors', async (t) => {
  const { request } = await fixture(t);
  const response = await request('/api/products');
  assert.equal(response.status, 200);
  const products = await response.json();
  assert.equal(products.length, 6);
  assert.deepEqual(products.map((product) => product.id), [1, 2, 3, 4, 5, 6]);
  assert.ok(products.every((product) => product.description && product.image.startsWith('/images/') && product.stock > 0 && Number.isInteger(product.price_cents)));
  assert.deepEqual(await (await request('/api/products/1')).json(), products[0]);
  assert.deepEqual((await (await request('/api/products?search=dice')).json()).map((product) => product.id), [1, 4, 5]);
  assert.deepEqual(await (await request('/api/products?search=%27%20OR%201%3D1--')).json(), []);
  assert.equal((await request('/api/products/not-an-id')).status, 404);
  assert.equal((await request('/api/products/999999')).status, 404);
});

test('login uses opaque HttpOnly sessions, reload restores identity, and logout invalidates the session', async (t) => {
  const { db, request, login } = await fixture(t);
  const wrong = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } });
  assert.equal(wrong.status, 401);
  const cookie = await login();
  const user = (await (await request('/api/auth/me', { cookie })).json()).user;
  assert.equal(user.name, 'Aria');
  assert.deepEqual(Object.keys(user).sort(), ['username', 'id', 'name']);
  const stored = db.prepare('SELECT * FROM sessions').get();
  assert.notEqual(stored.token_hash, cookie.split('=')[1]);
  assert.match(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash, /^scrypt:/);
  const logout = await request('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 204);
  assert.deepEqual(await (await request('/api/auth/me', { cookie })).json(), { user: null });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0);
  const fresh = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password } });
  assert.match(fresh.headers.get('set-cookie'), /HttpOnly/);
  assert.match(fresh.headers.get('set-cookie'), /SameSite=Lax/);
});

test('expired sessions cannot authenticate', async (t) => {
  const { db, request, login } = await fixture(t);
  const cookie = await login();
  db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
  assert.deepEqual(await (await request('/api/auth/me', { cookie })).json(), { user: null });
  assert.equal((await request('/api/orders', { cookie })).status, 401);
});

test('registration validates passwords and duplicate username, then signs in a new customer', async (t) => {
  const { db, request } = await fixture(t);
  const body = { name: 'New Adventurer', username: 'adventurer_test', password: 'MyNewAdventure!24' };
  assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...body, password: 'tiny' } })).status, 400);
  const response = await request('/api/auth/register', { method: 'POST', body });
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.name, body.name);
  assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 409);
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  assert.notEqual(user.password_hash, body.password);
  assert.equal(user.is_demo, 0);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: body.username, password: body.password } })).status, 200);
});

test('login attempts are rate limited with a retry time', async (t) => {
  const { request } = await fixture(t);
  for (let i = 0; i < 8; i += 1) {
    assert.equal((await request('/api/auth/login', { method: 'POST', body: {} })).status, 400);
  }
  const response = await request('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
});

test('checkout validates quantities and stock, calculates prices on the server, and stores the simulation', async (t) => {
  const { db, request, login } = await fixture(t);
  assert.equal((await request('/api/orders', { method: 'POST', body: { items: [] } })).status, 401);
  const cookie = await login();
  for (const items of [[], [{ product_id: 1, quantity: -1 }], [{ product_id: 1, quantity: 1.5 }], [{ product_id: 1, quantity: '2' }], [{ product_id: 1, quantity: 100 }], [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 1 }], [{ product_id: 999, quantity: 1 }]]) {
    assert.equal((await request('/api/orders', { method: 'POST', cookie, body: { items } })).status, 400);
  }
  assert.equal((await request('/api/orders', { method: 'POST', cookie, body: { items: [{ product_id: 1, quantity: 25 }] } })).status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
  const response = await request('/api/orders', { method: 'POST', cookie, body: { items: [{ product_id: 1, quantity: 2, price_cents: 1 }], total_cents: 2 } });
  assert.equal(response.status, 201);
  const { order } = await response.json();
  assert.equal(order.total_cents, 6800);
  assert.equal(order.items[0].price_cents, 3400);
  assert.equal(order.items[0].quantity, 2);
  assert.match(order.number, /^DL-/);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = 1').get().stock, 22);
  assert.equal(db.prepare('SELECT total_cents FROM orders WHERE id = ?').get(order.id).total_cents, 6800);
  assert.deepEqual((await (await request('/api/orders', { cookie })).json()).orders, [order]);
});

test('orders survive database reopen and remain private to the account that placed them', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-lore-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, 'shop.db');
  const { request, login } = await fixture(t, { filename });
  const aria = await login();
  const response = await request('/api/orders', { method: 'POST', cookie: aria, body: { items: [{ product_id: 2, quantity: 1 }] } });
  assert.equal(response.status, 201);
  const finn = await login('finn@diceandlore.test');
  assert.deepEqual((await (await request('/api/orders', { cookie: finn })).json()).orders, []);
  const secondConnection = openDatabase(filename, { demoAccounts: false });
  assert.equal(secondConnection.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
  assert.equal(secondConnection.prepare('SELECT stock FROM products WHERE id = 2').get().stock, 35);
  secondConnection.close();
});

test('API blocks foreign origins, malformed input, and returns JSON for missing endpoints', async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {}, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const invalid = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, rawBody: '{' });
  assert.equal(invalid.status, 400);
  const unsupported = await request('/api/auth/login', { method: 'POST' });
  assert.equal(unsupported.status, 415);
  const unknown = await request('/api/not-a-route');
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get('content-type'), /application\/json/);
  assert.match(unknown.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('production excludes demo credentials even when a development database is reused', async (t) => {
  const { request } = await fixture(t, { production: true });
  const response = await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password } });
  assert.equal(response.status, 401);
  const db = openDatabase(':memory:', { demoAccounts: false });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
  db.close();
});

test('active CWE-779 challenge logs full headers and large bodies', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-lore-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const logPath = path.join(directory, 'app.log');
  const { request } = await fixture(t, { challengeOptions: { logPath }, activeChallenges: ['log-flood'] });
  const payload = 'A'.repeat(50 * 1024);
  const response = await request('/api/log.flood', {
    method: 'POST',
    body: { text: payload },
    headers: { Authorization: 'Bearer secret-token', Cookie: 'session=leaky' },
  });
  assert.equal(response.status, 200);
  const contents = await readFile(logPath, 'utf8');
  assert.ok(contents.includes(payload));
  assert.ok(contents.includes('secret-token'));
  assert.ok(contents.includes('leaky'));
  const status = await (await request('/api/challenges/log-flood/status')).json();
  assert.ok(status.sizeBytes > 50 * 1024);
  assert.equal(status.achieved, false);
});

test('challenge reset clears only the log and can require an admin token', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-lore-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const logPath = path.join(directory, 'app.log');
  const { request } = await fixture(t, { challengeOptions: { logPath, adminToken: 'admin-secret' } });
  await request('/api/log.flood', { method: 'POST', body: { text: 'x' } });
  assert.equal((await request('/api/challenges/log-flood/reset', { method: 'POST' })).status, 403);
  const reset = await request('/api/challenges/log-flood/reset', { method: 'POST', headers: { 'x-challenge-token': 'admin-secret' } });
  assert.equal(reset.status, 200);
  const body = await reset.json();
  assert.equal(body.sizeBytes, 0);
  assert.equal((await (await request('/api/challenges/log-flood/status')).json()).sizeBytes, 0);
});

test('database initialization is repeatable and preserves custom catalogue data and stock', () => {
  const db = openDatabase(':memory:', { demoAccounts: false });
  db.prepare('UPDATE products SET name = ?, stock = ? WHERE id = 1').run('Custom Dice', 7);
  initializeDatabase(db, { demoAccounts: false });
  assert.deepEqual(db.prepare('SELECT name, stock FROM products WHERE id = 1').get(), { name: 'Custom Dice', stock: 7 });
  db.close();
  const legacy = new Database(':memory:');
  legacy.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL)');
  legacy.prepare('INSERT INTO products VALUES (1, ?, ?, ?)').run('My Existing Product', 'Preserve me', 1250);
  initializeDatabase(legacy, { demoAccounts: false });
  assert.equal(legacy.prepare('SELECT COUNT(*) AS count FROM products').get().count, 1);
  assert.equal(legacy.prepare('SELECT name FROM products').get().name, 'My Existing Product');
  legacy.close();
});

test('challenge flags default to safe and initialization preserves an explicit selection', async (t) => {
  const { db } = await fixture(t);
  assert.deepEqual(db.prepare('SELECT active FROM challenges').all(), [{ active: 0 }, { active: 0 }]);
  db.prepare("UPDATE challenges SET active = 1 WHERE id = 'log-flood'").run();
  initializeDatabase(db);
  assert.equal(db.prepare("SELECT active FROM challenges WHERE id = 'log-flood'").get().active, 1);
});

test('safe logging rejects large bodies, redacts secrets, rate limits and switches modes live', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-safe-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const logPath = path.join(directory, 'app.log');
  const { db, request } = await fixture(t, { challengeOptions: { logPath } });
  const send = (text) => request('/api/log.flood', {
    method: 'POST', body: { text }, headers: { Authorization: 'Bearer secret-token' },
  });
  assert.equal((await send('A'.repeat(50 * 1024))).status, 413);
  assert.equal((await send('private-body')).status, 200);
  const contents = await readFile(logPath, 'utf8');
  assert.ok(!contents.includes('private-body'));
  assert.ok(!contents.includes('secret-token'));
  for (let i = 0; i < 28; i += 1) assert.equal((await send('x')).status, 200);
  assert.equal((await send('x')).status, 429);
  db.prepare("UPDATE challenges SET active = 1 WHERE id = 'log-flood'").run();
  assert.equal((await send('A'.repeat(50 * 1024))).status, 200);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'log-flood'").run();
  assert.equal((await (await request('/api/challenges/log-flood/status')).json()).isActive, false);
});

test('weak hashing is limited to the demo target and disabling restores scrypt verification', async (t) => {
  const { db, request } = await fixture(t, { activeChallenges: ['weak-password'] });
  const user = db.prepare("SELECT * FROM users WHERE username = 'admin'").get();
  assert.match(user.password_hash, /^scrypt:/);
  assert.match(user.challenge_password_hash, /^[a-f0-9]{32}$/);
  const body = { username: user.username, password };
  assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 200);
  // Make the challenge credential differ, so this proves which branch is used.
  db.prepare('UPDATE users SET challenge_password_hash = ? WHERE id = ?').run('0'.repeat(32), user.id);
  assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 401);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'weak-password'").run();
  assert.equal((await request('/api/auth/login', { method: 'POST', body })).status, 200);
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash, user.password_hash);
});

test('production ignores active challenge flags', async (t) => {
  const { request } = await fixture(t, { production: true, activeChallenges: ['weak-password', 'log-flood'] });
  const status = await (await request('/api/challenges/log-flood/status')).json();
  assert.equal(status.isActive, false);
  assert.equal((await request('/api/log.flood', { method: 'POST', body: { text: 'A'.repeat(50 * 1024) } })).status, 413);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'admin', password } })).status, 401);
});
