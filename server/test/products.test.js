import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createApp } from '../app.js';
import { DEFAULT_DB_PATH, initializeDatabase, openDatabase, resolveDatabasePath } from '../db.js';
import { getProduct, getProducts, importProducts } from '../products.js';

const execute = promisify(execFile);
const serverDirectory = fileURLToPath(new URL('..', import.meta.url));
const importedProduct = {
  id: 41, name: 'Arcane Lantern', description: 'A product maintained in SQLite.',
  price_cents: 1250, category: 'Gear', image: '/images/adventurer-kit.svg', tag: '', stock: 9,
};

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dnd-products-'));
  const filename = path.join(directory, 'shop.db');
  const connections = [];
  const servers = [];
  t.after(async () => {
    for (const server of servers) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    for (const db of connections) if (db.open) db.close();
    await rm(directory, {recursive: true, force: true});
  });
  function open() {
    const db = openDatabase(filename, {demoAccounts: false});
    connections.push(db);
    return db;
  }
  async function serve(db) {
    const server = createApp(db, {production: false}).listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }
  return {directory, filename, open, serve};
}

test('imported products and direct database edits survive reopening and are returned by the real API', async t => {
  const f = await fixture(t);
  const db = f.open();
  assert.deepEqual(importProducts(db, [importedProduct]), {inserted: 1, updated: 0});
  assert.deepEqual(getProduct(db, 41), importedProduct);
  db.prepare('UPDATE products SET name = ?, price_cents = ?, stock = ? WHERE id = ?').run('Lantern from the database', 1999, 4, 41);
  db.close();
  const reopened = f.open();
  const base = await f.serve(reopened);
  const detail = await (await fetch(`${base}/api/products/41`)).json();
  assert.deepEqual(detail, {...importedProduct, name: 'Lantern from the database', price_cents: 1999, stock: 4});
  const list = await (await fetch(`${base}/api/products`)).json();
  assert.deepEqual(list.find(product => product.id === 41), detail);
  assert.deepEqual(reopened.prepare('SELECT name, price_cents, stock FROM products WHERE id = 41').get(), {name: detail.name, price_cents: 1999, stock: 4});
});

test('a deliberately emptied catalogue stays empty after initialization and restart', async t => {
  const f = await fixture(t);
  const db = f.open();
  assert.equal(getProducts(db).length, 6);
  db.prepare('DELETE FROM products').run();
  initializeDatabase(db, {demoAccounts: false});
  assert.deepEqual(getProducts(db), []);
  db.close();
  const reopened = f.open();
  const base = await f.serve(reopened);
  assert.deepEqual(await (await fetch(`${base}/api/products`)).json(), []);
  assert.equal((await fetch(`${base}/api/products/1`)).status, 404);
});

test('existing starter-looking database rows are preserved instead of replaced by source-code fixtures', () => {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL)');
    const rows = [['Coffee Mug', 'Ceramic mug, 300 ml', 1290], ['Notebook', 'A5, dotted pages', 890], ['Backpack', '20 L, water resistant', 4990], ['Desk Lamp', 'LED, dimmable', 2490], ['Water Bottle', 'Steel, 750 ml', 1990]];
    const save = db.prepare('INSERT INTO products (name, description, price_cents) VALUES (?, ?, ?)');
    rows.forEach(row => save.run(...row));
    initializeDatabase(db, {demoAccounts: false});
    assert.equal(getProducts(db).length, 5);
    assert.equal(getProduct(db, 1).name, 'Coffee Mug');
    assert.equal(getProduct(db, 1).price_cents, 1290);
  } finally { db.close(); }
});

test('an explicit import updates listed products and preserves all unrelated rows', () => {
  const db = openDatabase(':memory:', {demoAccounts: false});
  try {
    const untouched = getProduct(db, 2);
    const updated = {...getProduct(db, 1), name: 'Edited product', price_cents: 2599, stock: 0};
    assert.deepEqual(importProducts(db, [updated, importedProduct]), {inserted: 1, updated: 1});
    assert.deepEqual(getProduct(db, 1), updated);
    assert.deepEqual(getProduct(db, 2), untouched);
    assert.equal(getProducts(db).length, 7);
  } finally { db.close(); }
});

test('invalid and duplicate import rows are rejected without partially updating products', () => {
  const db = openDatabase(':memory:', {demoAccounts: false});
  try {
    const original = getProduct(db, 1);
    const badRows = [
      {...importedProduct, id: 0}, {...importedProduct, price_cents: -1}, {...importedProduct, price_cents: 1.5},
      {...importedProduct, stock: -1}, {...importedProduct, name: ''}, {...importedProduct, image: 'https://untrusted.example/image.svg'},
    ];
    for (const invalid of badRows) {
      assert.throws(() => importProducts(db, [{...original, name: 'Must not be saved'}, invalid]));
      assert.deepEqual(getProduct(db, 1), original);
    }
    assert.throws(() => importProducts(db, [importedProduct, importedProduct]));
    assert.equal(getProduct(db, 41), undefined);
  } finally { db.close(); }
});

test('an SQL failure rolls back the entire import transaction', () => {
  const db = openDatabase(':memory:', {demoAccounts: false});
  try {
    db.exec("CREATE TRIGGER reject_product BEFORE INSERT ON products WHEN NEW.id = 42 BEGIN SELECT RAISE(ABORT, 'Rejected import'); END;");
    assert.throws(() => importProducts(db, [importedProduct, {...importedProduct, id: 42}]));
    assert.equal(getProduct(db, 41), undefined);
    assert.equal(getProducts(db).length, 6);
  } finally { db.close(); }
});

test('search queries the stored data literally and treats wildcard and SQL-like input as text', () => {
  const db = openDatabase(':memory:', {demoAccounts: false});
  try {
    importProducts(db, [{...importedProduct, name: 'Lantern 100%_charged'}]);
    assert.deepEqual(getProducts(db, '%').map(product => product.id), [41]);
    assert.deepEqual(getProducts(db, '_').map(product => product.id), [41]);
    assert.deepEqual(getProducts(db, "' OR 1=1 --"), []);
    assert.deepEqual(getProducts(db, 'LANTERN').map(product => product.id), [41]);
  } finally { db.close(); }
});

test('the import command creates a persistent catalogue containing only the supplied database rows', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'products.json');
  await writeFile(file, JSON.stringify([importedProduct]));
  await execute(process.execPath, [path.join(serverDirectory, 'import-products.js'), file], {
    cwd: path.resolve(serverDirectory, '../client'),
    env: {...process.env, DB_PATH: f.filename, NODE_ENV: 'production'},
  });
  const db = f.open();
  assert.deepEqual(getProducts(db), [importedProduct]);
  const base = await f.serve(db);
  assert.deepEqual(await (await fetch(`${base}/api/products`)).json(), [importedProduct]);
});

test('invalid import input is validated before a new database is created', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'invalid.json');
  await writeFile(file, JSON.stringify([{...importedProduct, stock: -5}]));
  await assert.rejects(execute(process.execPath, [path.join(serverDirectory, 'import-products.js'), file], {
    env: {...process.env, DB_PATH: f.filename, NODE_ENV: 'production'},
  }));
  assert.equal(existsSync(f.filename), false);
});

test('the default database location is fixed to server/shop.db rather than the launch working directory', () => {
  assert.equal(DEFAULT_DB_PATH, path.join(serverDirectory, 'shop.db'));
  assert.equal(resolveDatabasePath('another.db'), path.join(serverDirectory, 'another.db'));
  assert.equal(resolveDatabasePath(':memory:'), ':memory:');
  assert.equal(resolveDatabasePath(path.join(os.tmpdir(), 'explicit.db')), path.join(os.tmpdir(), 'explicit.db'));
});
