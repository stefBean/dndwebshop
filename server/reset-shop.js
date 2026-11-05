import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolveDatabasePath } from './db.js';
import { importProducts } from './products.js';
import { hashPasswordSync } from './security.js';
import { passwordFixture, passwordChallengeTarget, resetPasswordChallenge } from './challenge-password.js';
import { createChallengeLog } from './challenge-log.js';
import { acquireRuntimeLock } from './runtime-lock.js';

const products = JSON.parse(readFileSync(new URL('./data/products.json', import.meta.url), 'utf8'));
const demoAccounts = [['Aria', 'aria'], ['Finn', 'finn']];
export function resetVersion(db) {
  return db.prepare('SELECT reset_version FROM shop_state WHERE id = 1').get().reset_version;
}

export function validateResetScope(db) {
  if (db.pragma('foreign_key_check').length) throw new Error('Reset refused: broken database relationships.');
  const registered = new Set(db.prepare('SELECT id FROM reset_products').all().map(row => row.id));
  const fixtureIds = new Set(products.map(row => row.id));
  for (const row of db.prepare('SELECT id FROM products').all()) {
    if (!registered.has(row.id) || !fixtureIds.has(row.id)) throw new Error('Reset refused: unknown product ' + row.id);
  }
  // A missing fixture can be restored, but an unrecognized existing ID cannot.
  const target = passwordChallengeTarget(db);
  for (const row of db.prepare('SELECT id, username, is_demo FROM users').all()) {
    const demo = row.is_demo === 1 && demoAccounts.some(([, username]) => row.username === username);
    if (!demo && row.id !== target?.id) throw new Error('Reset refused: unknown/non-test account ' + row.id);
  }
  if (!target && db.prepare('SELECT 1 FROM users WHERE username = ?').get(passwordFixture.username)) {
    throw new Error('Reset refused: reserved target username collision.');
  }
  const challenges = db.prepare('SELECT id FROM challenges').all();
  if (challenges.length !== 2 || challenges.some(row => !['weak-password', 'log-flood'].includes(row.id))) {
    throw new Error('Reset refused: unknown challenge configuration.');
  }
  // All orders/sessions now refer exclusively to the validated fixture users;
  // every order item refers to a validated product (foreign_key_check above).
}

// Caller must hold the runtime lock; tests use exclusively isolated databases.
export async function resetShop(db, log) {
  validateResetScope(db);
  // Validate and prepare expensive hashes before any destructive operation.
  const accounts = demoAccounts.map(([name, username]) => ({ name, username, hash: hashPasswordSync('RollForAdventure!24') }));
  await log.reset();
  const version = db.transaction(() => {
    validateResetScope(db);
    const active = db.prepare("SELECT active FROM challenges WHERE id = 'weak-password'").get().active;
    db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM sessions;');
    importProducts(db, products);
    for (const product of products) db.prepare('INSERT OR IGNORE INTO reset_products VALUES (?)').run(product.id);
    for (const account of accounts) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(account.username);
      if (existing) db.prepare('UPDATE users SET name = ?, password_hash = ?, challenge_password_hash = NULL WHERE id = ?').run(account.name, account.hash, existing.id);
      else db.prepare('INSERT INTO users (name, username, password_hash, is_demo) VALUES (?, ?, ?, 1)').run(account.name, account.username, account.hash);
    }
    if (active || db.prepare("SELECT target_user_id FROM challenges WHERE id = 'weak-password'").get().target_user_id) {
      resetPasswordChallenge(db);
      const target = passwordChallengeTarget(db);
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(passwordFixture.name, target.id);
    }
    db.prepare("UPDATE challenges SET active = ?, solved_at = NULL, revision = revision + 1 WHERE id = 'weak-password'").run(active);
    db.prepare("UPDATE challenges SET solved_at = NULL WHERE id = 'log-flood'").run();
    const next = randomUUID();
    db.prepare('UPDATE shop_state SET reset_version = ? WHERE id = 1').run(next);
    return next;
  }).immediate();
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let release, db;
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--check')) throw new Error('Usage: npm run reset:shop [-- --check]');
    const checkOnly = args[0] === '--check';
    const filename = resolveDatabasePath();
    if (!checkOnly) release = acquireRuntimeLock(filename);
    // Do not initialize/seed/purge anything before checking the existing scope.
    db = new Database(filename, { fileMustExist: true, readonly: checkOnly });
    db.pragma('foreign_keys = ON');
    if (checkOnly) {
      validateResetScope(db);
      console.log('Reset scope verified (read-only). Stop the shop before running the reset.');
    } else {
      const version = await resetShop(db, createChallengeLog());
      console.log('Shop reset complete. Challenge switches preserved. Reset version: ' + version);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally { db?.close(); release?.(); }
}
