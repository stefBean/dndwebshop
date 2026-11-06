import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../app.js';
import { openDatabase } from '../db.js';
import { hashPasswordMD5Sync, hashPasswordSync, verifyPassword } from '../security.js';

const password = 'RegistrationAdventure!24';
async function fixture(t, active = false) {
  const db = openDatabase(':memory:', { demoAccounts: false, seedProducts: false });
  // Keep this fixture independent of environment-controlled demo seeding.
  db.prepare("UPDATE challenges SET active = ? WHERE id = 'weak-password'").run(Number(active));
  const server = createApp(db, { production: false }).listen(0, '127.0.0.1');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body) => fetch(base + '/api/auth/' + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { db, post, base };
}

for (const active of [false, true]) {
  test(`registration and login keep normal users on scrypt with challenge=${active}`, async t => {
    const { db, post, base } = await fixture(t, active);
    const body = { name: ' New Ranger ', username: ' Ranger_24 ', password };
    const registered = await post('register', body);
    assert.equal(registered.status, 201);
    assert.deepEqual((await registered.json()).user, {
      id: db.prepare("SELECT id FROM users WHERE username = 'ranger_24'").get().id,
      name: 'New Ranger', username: 'ranger_24',
    });
    const cookie = registered.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.equal((await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie.split(';')[0] } })).json()).user.username, 'ranger_24');
    const stored = db.prepare("SELECT * FROM users WHERE username = 'ranger_24'").get();
    assert.equal(stored.is_demo, 0);
    assert.match(stored.password_hash, /^scrypt:/);
    assert.equal(await verifyPassword(password, stored.password_hash), true);
    assert.equal((await post('login', { username: ' RANGER_24 ', password })).status, 200);
    assert.equal((await post('login', { username: 'ranger_24', password: 'wrong' })).status, 401);
    db.prepare("UPDATE challenges SET active = ? WHERE id = 'weak-password'").run(Number(!active));
    assert.equal((await post('login', { username: 'ranger_24', password })).status, 200);
    assert.equal((await post('register', { ...body, username: 'RANGER_24' })).status, 409);
    assert.equal((await post('register', { ...body, username: 'second-ranger' })).status, 201);
    const other = db.prepare("SELECT password_hash FROM users WHERE username = 'second-ranger'").get();
    assert.notEqual(other.password_hash, stored.password_hash, 'same password receives a fresh salt');
    assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(stored.id).password_hash, stored.password_hash);
  });
}

test('registration and login enforce the same username limits as the frontend', async t => {
  for (const username of ['a', 'ab', 'a'.repeat(33), 'has spaces', 'name@example.test', null]) {
    await t.test(String(username), async t => {
      const { post } = await fixture(t);
      assert.equal((await post('register', { name: 'Ranger', username, password })).status, 400);
      assert.equal((await post('login', { username, password })).status, 400);
    });
  }
  for (const username of ['a.b', 'A_-' + 'x'.repeat(29)]) {
    await t.test(`valid ${username.length} characters`, async t => {
      const { post } = await fixture(t);
      assert.equal((await post('register', { name: 'Ranger', username, password })).status, 201);
      assert.equal((await post('login', { username, password })).status, 200);
    });
  }
});

test('invalid registration passwords do not insert users; unknown login returns 401', async t => {
  const { db, post } = await fixture(t);
  const before = db.prepare('SELECT count(*) AS count FROM users').get().count;
  for (const value of ['tiny', 'alllowercase123', 'ALLUPPERCASE123', 'MissingDigitsHere', 'A1' + 'a'.repeat(127)]) {
    assert.equal((await post('register', { name: 'Ranger', username: 'ranger', password: value })).status, 400);
  }
  assert.equal(db.prepare('SELECT count(*) AS count FROM users').get().count, before);
  assert.equal((await post('login', { username: 'missing-user', password })).status, 401);
});

test('demo challenge credential is used only while active; disabling restores scrypt', async t => {
  const { db, post } = await fixture(t, true);
  const safeHash = hashPasswordSync(password);
  db.prepare('INSERT INTO users (name, username, password_hash, is_demo, challenge_password_hash) VALUES (?, ?, ?, 1, ?)')
    .run('Demo', 'demo-target', safeHash, hashPasswordMD5Sync('challenge-password'));
  assert.equal((await post('login', { username: 'demo-target', password: 'challenge-password' })).status, 200);
  assert.equal((await post('login', { username: 'demo-target', password })).status, 401);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'weak-password'").run();
  assert.equal((await post('login', { username: 'demo-target', password })).status, 200);
  assert.equal((await post('login', { username: 'demo-target', password: 'challenge-password' })).status, 401);
  assert.equal(db.prepare("SELECT password_hash FROM users WHERE username = 'demo-target'").get().password_hash, safeHash);
});

test('existing MD5 demo accounts still work in the active password challenge', async t => {
  const { db, post } = await fixture(t, true);
  db.prepare('INSERT INTO users (name, username, password_hash, is_demo) VALUES (?, ?, ?, 1)')
    .run('Legacy Demo', 'legacy-demo', hashPasswordMD5Sync(password));
  assert.equal((await post('login', { username: 'legacy-demo', password })).status, 200);
  assert.equal((await post('login', { username: 'legacy-demo', password: 'wrong' })).status, 401);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'weak-password'").run();
  assert.equal((await post('login', { username: 'legacy-demo', password })).status, 401);
});
