import Database from 'better-sqlite3';
import { catalog } from './catalog.js';
import { hashPasswordSync } from './security.js';

const originalFixtures = [
  ['Coffee Mug', 'Ceramic mug, 300 ml', 1290],
  ['Notebook', 'A5, dotted pages', 890],
  ['Backpack', '20 L, water resistant', 4990],
  ['Desk Lamp', 'LED, dimmable', 2490],
  ['Water Bottle', 'Steel, 750 ml', 1990],
];

export function initializeDatabase(db, { demoAccounts = process.env.NODE_ENV !== 'production' } = {}) {
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
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
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
  `);
  const columns = new Set(db.pragma('table_info(products)').map((column) => column.name));
  for (const [name, definition] of [
    ['category', "TEXT NOT NULL DEFAULT 'Gear'"],
    ['image', "TEXT NOT NULL DEFAULT '/images/adventurer-kit.svg'"],
    ['tag', "TEXT NOT NULL DEFAULT ''"],
    ['stock', 'INTEGER NOT NULL DEFAULT 50'],
  ]) {
    if (!columns.has(name)) db.exec(`ALTER TABLE products ADD COLUMN ${name} ${definition}`);
  }

  const products = db.prepare('SELECT id, name, description, price_cents FROM products ORDER BY id').all();
  const replaceOriginal = products.length === originalFixtures.length && products.every((product, index) => {
    const [name, description, price] = originalFixtures[index];
    return product.id === index + 1 && product.name === name && product.description === description && product.price_cents === price;
  }) && db.prepare('SELECT COUNT(*) AS count FROM orders').get().count === 0;
  if (products.length === 0 || replaceOriginal) {
    const save = db.prepare(`INSERT INTO products (id, name, description, price_cents, category, image, tag, stock)
      VALUES (@id, @name, @description, @price_cents, @category, @image, @tag, @stock)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
        price_cents=excluded.price_cents, category=excluded.category, image=excluded.image,
        tag=excluded.tag, stock=excluded.stock`);
    db.transaction(() => catalog.forEach((product) => save.run(product)))();
  }

  if (demoAccounts) {
    const insert = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, is_demo) VALUES (?, ?, ?, 1)');
    for (const [name, email] of [['Aria', 'aria@diceandlore.test'], ['Finn', 'finn@diceandlore.test']]) {
      if (!db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        insert.run(name, email, hashPasswordSync('RollForAdventure!24'));
      }
    }
  }
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  return db;
}

export function openDatabase(filename = process.env.DB_PATH || 'shop.db', options) {
  return initializeDatabase(new Database(filename), options);
}
