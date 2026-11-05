import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, initializeDatabase } from '../db.js';
import { createApp } from '../app.js';
import { resetShop, resetVersion } from '../reset-shop.js';
import { acquireRuntimeLock } from '../runtime-lock.js';
import { createChallengeLog } from '../challenge-log.js';
import { setPasswordChallengeActive, passwordChallengeState } from '../challenge-password.js';
import { verifyPassword } from '../security.js';

const runFile = promisify(execFile);
const fixtureProducts = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url), 'utf8'));
async function fixture(t, filename = ':memory:') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'chs-reset-'));
  const db = openDatabase(filename === ':memory:' ? filename : path.join(directory, filename));
  const log = createChallengeLog({ logPath: path.join(directory, 'app.log'), isActive: () => true });
  t.after(async () => { db.close(); await rm(directory, { recursive: true, force: true }); });
  return { db, log, directory };
}

test('full reset is repeatable, restores fixtures and clears orders, sessions and both challenge results while preserving switches', async t => {
  const { db, log } = await fixture(t);
  setPasswordChallengeActive(db, true);
  db.prepare("UPDATE challenges SET active = 1 WHERE id = 'log-flood'").run();
  for (let run = 0; run < 2; run++) {
    const previous = resetVersion(db);
    const userId = db.prepare("SELECT id FROM users WHERE username = 'aria'").get().id;
    db.prepare('INSERT INTO orders (number, user_id, total_cents) VALUES (?, ?, 1)').run('TEST-' + run, userId);
    const orderId = db.prepare('SELECT id FROM orders').get().id;
    db.prepare('INSERT INTO order_items (order_id, product_id, name, quantity, price_cents) VALUES (?, 1, ?, 1, 1)').run(orderId, 'Test');
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('test-session', userId, Date.now() + 60000);
    db.prepare("UPDATE users SET name = 'Changed', password_hash = 'changed' WHERE id = ?").run(userId);
    db.prepare("UPDATE products SET name = 'Changed', price_cents = 1, stock = 0 WHERE id = 1").run();
    db.prepare("DELETE FROM products WHERE id = 6").run();
    db.prepare("UPDATE challenges SET solved_at = 'test'").run();
    await writeFile(log.logPath, 'X'.repeat(11 * 1024 * 1024));
    assert.equal((await log.status()).achieved, true);
    const version = await resetShop(db, log);
    assert.notEqual(version, previous);
    for (const table of ['orders', 'order_items', 'sessions']) assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n, 0);
    assert.deepEqual(db.prepare('SELECT id, name, description, price_cents, category, image, tag, stock FROM products ORDER BY id').all(), fixtureProducts);
    for (const [name, username] of [['Aria', 'aria'], ['Finn', 'finn']]) {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      assert.equal(user.name, name);
      assert.equal(await verifyPassword('RollForAdventure!24', user.password_hash), true);
    }
    assert.equal(passwordChallengeState(db).solved_at, null);
    assert.deepEqual(db.prepare('SELECT active FROM challenges ORDER BY id').all(), [{ active: 1 }, { active: 1 }]);
    assert.equal((await log.status()).sizeBytes, 0);
    assert.equal((await log.status()).achieved, false);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  }
  setPasswordChallengeActive(db, false);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'log-flood'").run();
  await resetShop(db, log);
  assert.deepEqual(db.prepare('SELECT active FROM challenges ORDER BY id').all(), [{ active: 0 }, { active: 0 }]);
});

test('reset of an unprovisioned disabled challenge does not activate or create its target', async t => {
  const { db, log } = await fixture(t);
  await resetShop(db, log);
  assert.equal(passwordChallengeState(db).target_user_id, null);
  assert.equal(passwordChallengeState(db).active, 0);
});

test('unknown accounts, products, challenges and identity collisions abort before clearing logs or any rows', async t => {
  for (const sql of [
    "INSERT INTO users (name, username, password_hash) VALUES ('Other', 'other', 'keep')",
    "UPDATE users SET is_demo = 0 WHERE username = 'aria'",
    "INSERT INTO products (id, name, price_cents) VALUES (99, 'Other', 123)",
    "INSERT INTO challenges (id) VALUES ('other')",
  ]) {
    const { db, log } = await fixture(t);
    db.exec(sql);
    await writeFile(log.logPath, 'keep-log');
    const before = db.serialize();
    await assert.rejects(resetShop(db, log), /Reset refused/);
    assert.deepEqual(db.serialize(), before);
    assert.equal(await readFile(log.logPath, 'utf8'), 'keep-log');
  }
});

test('migration does not adopt a foreign product merely because its ID matches a fixture', async t => {
  const { db, log } = await fixture(t);
  db.prepare('DELETE FROM reset_products WHERE id = 1').run();
  db.prepare("UPDATE products SET name = 'Foreign product' WHERE id = 1").run();
  db.prepare("DELETE FROM schema_migrations WHERE id = 'reset-scope-v1'").run();
  initializeDatabase(db);
  assert.equal(db.prepare('SELECT 1 FROM reset_products WHERE id = 1').get(), undefined);
  await assert.rejects(resetShop(db, log), /unknown product 1/);
});

test('login and checkout work after reset; stale/missing generations never create orders even with a new valid session', async t => {
  const { db, log } = await fixture(t);
  const oldVersion = resetVersion(db);
  await resetShop(db, log);
  const server = createApp(db, { challengeOptions: { logPath: log.logPath } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (url, body, headers = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const login = await request('/api/auth/login', { username: 'aria', password: 'RollForAdventure!24' });
  assert.equal(login.status, 200);
  const Cookie = login.headers.get('set-cookie').split(';')[0];
  const body = { items: [{ product_id: 1, quantity: 1 }] };
  for (const version of [undefined, oldVersion, 'forged']) {
    const result = await request('/api/orders', body, { Cookie, ...(version ? { 'X-Shop-Reset-Version': version } : {}) });
    assert.equal(result.status, 409);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 0);
  }
  const state = await fetch(base + '/api/shop/state');
  assert.match(state.headers.get('cache-control'), /no-store/);
  const version = (await state.json()).resetVersion;
  assert.equal((await request('/api/orders', body, { Cookie, 'X-Shop-Reset-Version': version })).status, 201);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM order_items').get().n, 1);
});

test('operator CLI shares the server lock, refuses a running shop and works repeatedly on a stopped isolated database', async t => {
  const { db, directory, log } = await fixture(t, 'shop.db');
  const filename = path.join(directory, 'shop.db');
  const options = { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, DB_PATH: filename, CHALLENGE_LOG_PATH: log.logPath } };
  const release = acquireRuntimeLock(filename);
  assert.throws(() => acquireRuntimeLock(filename), /Stop the shop/);
  assert.match((await runFile(process.execPath, ['reset-shop.js', '--check'], options)).stdout, /read-only/);
  assert.equal(resetVersion(db), 'initial');
  await assert.rejects(runFile(process.execPath, ['reset-shop.js'], options), /Stop the shop/);
  assert.equal(resetVersion(db), 'initial');
  release();
  for (let i = 0; i < 2; i++) assert.match((await runFile(process.execPath, ['reset-shop.js'], options)).stdout, /Shop reset complete/);
  assert.notEqual(resetVersion(db), 'initial');
});
