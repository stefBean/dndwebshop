import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProducts } from './products.js';
import { hashPasswordSync } from './security.js';
import { createChallengeState } from './challenges.js';
import { createChallengeRouter } from './challenge-log.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const starterProductsFile = path.join(serverDirectory, 'data/products.json');
const starterMigration = 'initial-products-v1';


export const DEFAULT_DB_PATH = path.join(serverDirectory, 'shop.db');

export function resolveDatabasePath(filename = process.env.DB_PATH || DEFAULT_DB_PATH) {
  return filename === ':memory:' ? filename : path.resolve(serverDirectory, filename);
}



function migrateUsernames(db) {
  const columns = new Set(db.pragma('table_info(users)').map((column) => column.name));
  if (!columns.has('email') || columns.has('username')) return;
  db.transaction(() => {
    db.exec('ALTER TABLE users RENAME COLUMN email TO username');
    const users = db.prepare('SELECT id, username FROM users ORDER BY id').all();
    const valid = (value) => /^[a-z0-9_.-]{3,32}$/i.test(value);
    const taken = new Set(users.filter((user) => valid(user.username)).map((user) => user.username.toLowerCase()));
    const update = db.prepare('UPDATE users SET username = ? WHERE id = ?');
    for (const user of users) {
      if (valid(user.username)) continue;
      let base = user.username.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 32);
      if (base.length < 3) base = `user-${base}`;
      let username = base;
      let suffix = 1;
      while (taken.has(username)) {
        const ending = `-${suffix++}`;
        username = base.slice(0, 32 - ending.length) + ending;
      }
      update.run(username, user.id);
      taken.add(username);
    }
  }).immediate();
}


export function initializeDatabase(db, {
  seedProducts = true,
  demoAccounts =
  process.env.NODE_ENV !== 'production' ||
  (
    process.env.INTERNAL_HTTP_TEST === 'true' &&
    process.env.ENABLE_DEMO_ACCOUNTS === 'true'
  )
} = {}) {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0, 1))
    );
    INSERT OR IGNORE INTO challenges (id) VALUES ('weak-password'), ('log-flood'), ('xss');
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      price_cents INTEGER NOT NULL CHECK(price_cents >= 0)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const columns = new Set(db.pragma('table_info(products)').map((column) => column.name));
  demoAccounts =
    process.env.NODE_ENV !== 'production' ||
    (
      process.env.INTERNAL_HTTP_TEST === 'true' &&
      process.env.ENABLE_DEMO_ACCOUNTS === 'true'
    )
    
  const challenges = createChallengeState(db, {
    production: process.env.NODE_ENV === 'production',
  });

  for (const [name, definition] of [
    ['category', "TEXT NOT NULL DEFAULT 'Gear'"],
    ['image', "TEXT NOT NULL DEFAULT '/images/adventurer-kit.svg'"],
    ['tag', "TEXT NOT NULL DEFAULT ''"],
    ['stock', 'INTEGER NOT NULL DEFAULT 50'],
  ]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
  }

  migrateUsernames(db);
  const userColumns = new Set(db.pragma('table_info(users)').map((column) => column.name));
  if (!userColumns.has('challenge_password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN challenge_password_hash TEXT');
  }

  // Bootstrap an empty database once. Existing catalogue rows are authoritative;
  // an intentionally emptied catalogue must stay empty after future restarts.
  db.transaction(() => {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').get(starterMigration)) return;
    const empty = db.prepare('SELECT COUNT(*) AS count FROM products').get().count === 0;
    if (seedProducts && empty) {
      const starterProducts = JSON.parse(readFileSync(starterProductsFile, 'utf8'));
      importProducts(db, starterProducts, { overwrite: false });
    }
    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(starterMigration);
  }).immediate();

  if (demoAccounts) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO users (name, username, password_hash, is_demo) VALUES (?, ?, ?, 1)'
    );

    const users = [];
    if (demoAccounts) {
      const users = [
        ['Aria', 'aria', hashPasswordSync('RollForAdventure!24')],
        ['Finn', 'finn', hashPasswordSync('RollForAdventure!24')],
        ...(challenges.isActive('weak-password')
        ? [['Admin', 'admin', '0cef1fb10f60529028a71f58e54ed07b']]
        : []),
      ];
    } 


    for (const [name, username, passwordHash] of users) {
      if (!db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
        insert.run(name, username, passwordHash);
      }
    }
  }

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  return db;
}




export function openDatabase(filename = process.env.DB_PATH || 'shop.db', options) {
  return initializeDatabase(new Database(resolveDatabasePath(filename)), options);
}
