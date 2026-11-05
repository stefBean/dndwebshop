import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';
import { createApp } from '../app.js';
import { initializeDatabase, openDatabase } from '../db.js';
import {
  passwordFixture, ARGON2_OPTIONS, passwordChallengeState, passwordChallengeTarget,
  passwordLoginSnapshot, passwordLoginIsCurrent, setPasswordChallengeActive, resetPasswordChallenge,
} from '../challenge-password.js';
import { crackBcrypt, extractHash } from '../tools/check-bcrypt.mjs';

const runFile = promisify(execFile);
const serverDirectory = path.resolve(import.meta.dirname, '..');
const wordlistPath = path.join(serverDirectory, 'public/weak-password/wordlist-test.txt');
const wordlist = await readFile(wordlistPath, 'utf8');
const cracked = await crackBcrypt(passwordFixture.bcryptHash, wordlist);
assert.ok(cracked);
const targetPassword = cracked.password;

async function fixture(t, { active = true, production = true, filename = ':memory:' } = {}) {
  const db = openDatabase(filename, { demoAccounts: true });
  if (active !== null) setPasswordChallengeActive(db, active);
  const server = createApp(db, { production }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (url, { body, cookie, ...options } = {}) => fetch(base + url, {
    ...options,
    headers: { ...(url === '/api/orders' ? { 'X-Shop-Reset-Version': db.prepare('SELECT reset_version FROM shop_state WHERE id = 1').get().reset_version } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const login = (username = passwordFixture.username, password = targetPassword) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } });
  const status = async () => (await request('/api/challenges/weak-password/status')).json();
  return { db, request, login, status };
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cwe916-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('robots and the discovery wordlist provide an anonymous reproducible entry', async (t) => {
  const { request } = await fixture(t);
  const robots = await request('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type'), /text\/plain/);
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /api/backup/\n');
  const discovery = await (await request('/challenge-assets/weak-password/endpoint-discovery.txt')).text();
  assert.ok(discovery.split(/\r?\n/).includes('users'));
  assert.ok(!discovery.includes('/api/backup/users'));
});

test('production-mode backup needs no session and exports exactly the ID-bound fictitious account', async (t) => {
  const { db, request } = await fixture(t);
  const response = await request('/api/backup/users');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), {
    users: [{ username: passwordFixture.username, password_hash: passwordFixture.bcryptHash }],
  });
  assert.equal(bcrypt.getRounds(passwordChallengeTarget(db).challenge_password_hash), 4);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  for (const query of ['?id=1', '?file=shop.db', '?sql=SELECT+*+FROM+users', '?username=aria']) {
    assert.equal((await request('/api/backup/users' + query)).status, 400);
  }
  for (const url of ['/api/backup/', '/api/backup/orders', '/api/backup/shop.db',
    '/api/backup/shop.db-wal', '/api/backup/shop.db-shm', '/api/backup/users/1']) {
    assert.equal((await request(url)).status, 404);
  }
});

test('disabled and never-provisioned challenge hide the backup, while status reveals no credentials', async (t) => {
  const { db, request, status } = await fixture(t, { active: null });
  assert.equal((await request('/api/backup/users')).status, 404);
  assert.equal(passwordChallengeState(db).target_user_id, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 2);
  assert.deepEqual(await status(), {
    active: false, ready: false, achieved: false, solvedAt: null, mode: 'safe-argon2id',
  });
});

test('wordlist has exactly one matching candidate away from the start and the downloadable tool is offline', async (t) => {
  const { request } = await fixture(t);
  const downloaded = await (await request('/challenge-assets/weak-password/wordlist-test.txt')).text();
  const candidates = downloaded.trim().split(/\r?\n/);
  assert.equal(candidates.length, 80);
  assert.equal(new Set(candidates).size, candidates.length);
  const matches = [];
  for (const [index, candidate] of candidates.entries()) {
    if (await bcrypt.compare(candidate, passwordFixture.bcryptHash)) matches.push(index);
  }
  assert.deepEqual(matches, [46]);
  assert.equal(downloaded, wordlist);
  assert.equal(extractHash(JSON.stringify({ users: [{ password_hash: passwordFixture.bcryptHash }] })), passwordFixture.bcryptHash);
  const toolResponse = await request('/challenge-assets/weak-password/check-bcrypt.mjs');
  assert.equal(toolResponse.status, 200);
  const tool = await toolResponse.text();
  assert.ok(!tool.includes('fetch('));
  assert.ok(!tool.includes('http.request'));
  assert.ok(!tool.includes(targetPassword));
  const page = await readFile(path.join(serverDirectory, '../client/src/pages/ChallengesPage.jsx'), 'utf8');
  const readme = await readFile(path.join(serverDirectory, '../README.md'), 'utf8');
  for (const publicText of [page, readme]) {
    assert.ok(!publicText.includes(targetPassword));
    assert.ok(!publicText.includes(passwordFixture.bcryptHash));
  }
  assert.ok(!page.includes('/api/backup/users'));
});

test('offline CLI processes a local exported JSON file and reports a match without a server', async (t) => {
  const directory = await temporaryDirectory(t);
  const backup = path.join(directory, 'backup.json');
  await writeFile(backup, JSON.stringify({ users: [{ username: passwordFixture.username, password_hash: passwordFixture.bcryptHash }] }));
  const result = await runFile(process.execPath, ['tools/check-bcrypt.mjs', backup, wordlistPath], { cwd: serverDirectory });
  assert.ok(result.stdout.includes(targetPassword));
  assert.match(result.stdout, /Candidates checked: 47/);
  assert.equal(await crackBcrypt(passwordFixture.bcryptHash, 'WrongCandidate!99\n'), null);
  await assert.rejects(crackBcrypt(passwordFixture.bcryptHash.replace('$04$', '$12$'), wordlist), /cost 4/);
});

test('wrong passwords and unknown accounts cannot create sessions or a completion', async (t) => {
  const { db, login, status } = await fixture(t);
  assert.equal((await login(passwordFixture.username, 'WrongCandidate!99')).status, 401);
  assert.equal((await login('unknown-user')).status, 401);
  assert.equal((await status()).achieved, false);
  assert.equal(passwordChallengeState(db).solved_at, null);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});

test('successful weak login persists completion, uses the normal session, and supports logout', async (t) => {
  const { db, request, login, status } = await fixture(t);
  const response = await login();
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  const user = (await response.json()).user;
  assert.deepEqual(Object.keys(user).sort(), ['id', 'name', 'username']);
  assert.equal((await (await request('/api/auth/me', { cookie })).json()).user.username, passwordFixture.username);
  const progress = await status();
  assert.equal(progress.achieved, true);
  assert.ok(progress.solvedAt);
  assert.equal(passwordChallengeState(db).solved_at, progress.solvedAt);
  const token = db.prepare('SELECT token_hash FROM sessions').get().token_hash;
  assert.notEqual(token, cookie.split('=')[1]);
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie })).status, 204);
  assert.deepEqual(await (await request('/api/auth/me', { cookie })).json(), { user: null });
  assert.equal((await status()).achieved, true);
});

test('regular demo and registered users keep scrypt and never solve the exercise', async (t) => {
  const { db, request, login, status } = await fixture(t, { production: false });
  const before = db.prepare('SELECT * FROM users WHERE username IN (?, ?) ORDER BY id').all('aria', 'finn');
  for (const username of ['aria', 'finn']) {
    assert.equal((await login(username, 'RollForAdventure!24')).status, 200);
    assert.match(db.prepare('SELECT password_hash FROM users WHERE username = ?').get(username).password_hash, /^scrypt:/);
  }
  const body = { name: 'Regular User', username: 'regular-user', password: 'RegularAdventure!73' };
  assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 201);
  assert.equal((await login(body.username, body.password)).status, 200);
  assert.equal((await status()).achieved, false);
  setPasswordChallengeActive(db, false);
  assert.equal((await login('aria', 'RollForAdventure!24')).status, 200);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE username IN (?, ?) ORDER BY id').all('aria', 'finn'), before);
});

test('safe mode blocks export, invalidates weak sessions and verifies only Argon2id', async (t) => {
  const { db, request, login, status } = await fixture(t);
  const weakLogin = await login();
  const cookie = weakLogin.headers.get('set-cookie').split(';')[0];
  setPasswordChallengeActive(db, false);
  assert.equal((await request('/api/backup/users')).status, 404);
  assert.deepEqual(await (await request('/api/auth/me', { cookie })).json(), { user: null });
  const target = passwordChallengeTarget(db);
  assert.match(target.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  const alternate = 'DifferentCandidate!73';
  db.prepare('UPDATE users SET challenge_password_hash = ? WHERE id = ?').run(await bcrypt.hash(alternate, 4), target.id);
  assert.equal((await login(passwordFixture.username, alternate)).status, 401);
  assert.equal((await login()).status, 200);
  assert.equal((await status()).achieved, false);
  assert.equal((await status()).mode, 'safe-argon2id');
  // Even an accidental bcrypt value in the secure slot must not be accepted.
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordFixture.bcryptHash, target.id);
  assert.equal((await login()).status, 401);
});

test('fresh Argon2id hashes use random salts and OWASP minimum parameters', async () => {
  const first = await argon2.hash(targetPassword, ARGON2_OPTIONS);
  const second = await argon2.hash(targetPassword, ARGON2_OPTIONS);
  assert.notEqual(first, second);
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await argon2.verify(first, targetPassword), true);
  assert.equal(await argon2.verify(second, 'wrong'), false);
  assert.equal(await argon2.verify(passwordFixture.argon2Hash, targetPassword), true);
});

test('reset restores the fixture and playable mode without changing any other shop data', async (t) => {
  const { db, login, request, status } = await fixture(t, { production: false });
  const regular = await login('aria', 'RollForAdventure!24');
  const regularCookie = regular.headers.get('set-cookie').split(';')[0];
  const placed = await request('/api/orders', {
    method: 'POST', cookie: regularCookie, body: { items: [{ product_id: 1, quantity: 1 }] },
  });
  assert.equal(placed.status, 201);
  const weak = await login();
  const targetCookie = weak.headers.get('set-cookie').split(';')[0];
  const target = passwordChallengeTarget(db);
  db.prepare("UPDATE challenges SET active = 1 WHERE id = 'log-flood'").run();
  const snapshot = () => ({
    users: db.prepare('SELECT * FROM users WHERE id != ? ORDER BY id').all(target.id),
    sessions: db.prepare('SELECT * FROM sessions WHERE user_id != ? ORDER BY token_hash').all(target.id),
    products: db.prepare('SELECT * FROM products ORDER BY id').all(),
    orders: db.prepare('SELECT * FROM orders ORDER BY id').all(),
    items: db.prepare('SELECT * FROM order_items ORDER BY id').all(),
    challenges: db.prepare('SELECT * FROM challenges WHERE id != ? ORDER BY id').all('weak-password'),
  });
  const before = snapshot();
  db.prepare('UPDATE users SET challenge_password_hash = ? WHERE id = ?').run('broken', target.id);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'weak-password'").run();
  for (let n = 0; n < 2; n++) {
    resetPasswordChallenge(db);
    assert.deepEqual(snapshot(), before);
    assert.equal(passwordChallengeTarget(db).challenge_password_hash, passwordFixture.bcryptHash);
    assert.equal(passwordChallengeTarget(db).password_hash, passwordFixture.argon2Hash);
    assert.equal((await status()).achieved, false);
    assert.equal((await status()).active, true);
  }
  assert.deepEqual(await (await request('/api/auth/me', { cookie: targetCookie })).json(), { user: null });
  assert.equal((await login()).status, 200);
});

test('old asynchronous login snapshots cannot survive a reset or a mode change', async (t) => {
  const { db } = await fixture(t);
  const original = passwordLoginSnapshot(db, passwordChallengeTarget(db));
  assert.equal(passwordLoginIsCurrent(db, original), true);
  resetPasswordChallenge(db);
  assert.equal(passwordLoginIsCurrent(db, original), false);
  const current = passwordLoginSnapshot(db, passwordChallengeTarget(db));
  setPasswordChallengeActive(db, false);
  assert.equal(passwordLoginIsCurrent(db, current), false);
});

test('a reset during bcrypt verification cannot create a session or solve a new run', async (t) => {
  const { db, login, status } = await fixture(t);
  const compare = bcrypt.compare.bind(bcrypt);
  t.mock.method(bcrypt, 'compare', async (...args) => {
    const verified = await compare(...args);
    resetPasswordChallenge(db);
    return verified;
  });
  assert.equal((await login()).status, 401);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.equal((await status()).achieved, false);
});

test('username collisions and invalid target mappings never adopt or export another user', async (t) => {
  const { db, request } = await fixture(t, { active: null });
  db.prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)').run('Existing Customer', passwordFixture.username, 'unchanged');
  const before = db.prepare('SELECT * FROM users ORDER BY id').all();
  assert.throws(() => setPasswordChallengeActive(db, true), /already exists/);
  assert.deepEqual(db.prepare('SELECT * FROM users ORDER BY id').all(), before);
  assert.equal(passwordChallengeState(db).active, 0);
  const aria = db.prepare("SELECT * FROM users WHERE username = 'aria'").get();
  db.prepare("UPDATE challenges SET active = 1, target_user_id = ? WHERE id = 'weak-password'").run(aria.id);
  const response = await request('/api/backup/users');
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes(aria.password_hash));
});

test('initialization and reopening preserve completion, selected mode and all regular account fields', async (t) => {
  const directory = await temporaryDirectory(t);
  const filename = path.join(directory, 'shop.db');
  const db = openDatabase(filename, { demoAccounts: true });
  const original = db.prepare('SELECT * FROM users ORDER BY id').all();
  setPasswordChallengeActive(db, true);
  db.prepare("UPDATE challenges SET solved_at = '2026-11-05T12:00:00Z' WHERE id = 'weak-password'").run();
  initializeDatabase(db, { demoAccounts: true });
  db.close();
  const reopened = openDatabase(filename, { demoAccounts: true });
  try {
    assert.equal(passwordChallengeState(reopened).solved_at, '2026-11-05T12:00:00Z');
    assert.equal(passwordChallengeState(reopened).active, 1);
    assert.deepEqual(reopened.prepare('SELECT * FROM users WHERE id != ? ORDER BY id').all(passwordChallengeTarget(reopened).id), original);
    assert.deepEqual(reopened.pragma('foreign_key_check'), []);
  } finally { reopened.close(); }
});

test('local activation and reset commands use the existing DB and preserve unrelated expired sessions', async (t) => {
  const directory = await temporaryDirectory(t);
  const filename = path.join(directory, 'shop.db');
  const db = openDatabase(filename, { demoAccounts: true });
  const aria = db.prepare("SELECT id FROM users WHERE username = 'aria'").get();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run('expired-but-unrelated', aria.id, 1);
  db.close();
  const env = { ...process.env, DB_PATH: filename, NODE_ENV: 'production' };
  const options = { cwd: serverDirectory, env };
  await runFile(process.execPath, ['challenge-state.js', 'weak-password', 'true'], options);
  await runFile(process.execPath, ['challenge-state.js', 'weak-password', 'false'], options);
  for (let n = 0; n < 2; n++) {
    const result = await runFile(process.execPath, ['reset-password-challenge.js'], options);
    assert.match(result.stdout, /active=true, solved=false/);
  }
  // Read directly, avoiding initialization's normal expiry cleanup.
  const { default: Database } = await import('better-sqlite3');
  const check = new Database(filename, { readonly: true });
  try {
    assert.equal(passwordChallengeState(check).active, 1);
    assert.equal(check.prepare('SELECT count(*) AS n FROM sessions WHERE token_hash = ?').get('expired-but-unrelated').n, 1);
    assert.equal(check.prepare('SELECT count(*) AS n FROM users').get().n, 3);
  } finally { check.close(); }
});

test('production logging follows its own explicit switch and preserves XSS config', async (t) => {
  const { db, request } = await fixture(t);
  db.prepare("UPDATE challenges SET active = 0 WHERE id = 'log-flood'").run();
  assert.equal((await (await request('/api/challenges/log-flood/status')).json()).isActive, false);
  assert.equal((await request('/api/log.flood', { method: 'POST', body: { text: 'A'.repeat(50 * 1024) } })).status, 413);
  assert.deepEqual(await (await request('/api/challenges/xss/config')).json(), { previewOrigin: 'http://127.0.0.1:8081' });
  const response = await request('/api/products');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
});

test('teacher material, fixtures and database files have no public asset route', async (t) => {
  const { request } = await fixture(t);
  for (const url of [
    '/challenge-assets/weak-password/weak-password-fixture.json',
    '/challenge-assets/weak-password/teacher.md',
    '/api/backup/shop.db', '/api/backup/shop.db-wal', '/api/backup/shop.db-shm',
  ]) {
    const response = await request(url);
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.ok(!body.includes(passwordFixture.argon2Hash));
    assert.ok(!body.includes(passwordFixture.bcryptHash));
    assert.ok(!body.includes('SQLite format 3'));
  }
});
