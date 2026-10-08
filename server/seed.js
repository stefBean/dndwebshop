import { db } from './db.js';

db.exec(`
  DROP TABLE IF EXISTS products;
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL
  );
`);

const insert = db.prepare(
    'INSERT INTO products (name, description, price_cents) VALUES (?, ?, ?)'
);
[
    ['Coffee Mug', 'Ceramic mug, 300 ml', 1290],
    ['Notebook', 'A5, dotted pages', 890],
    ['Backpack', '20 L, water resistant', 4990],
    ['Desk Lamp', 'LED, dimmable', 2490],
    ['Water Bottle', 'Steel, 750 ml', 1990],
].forEach((p) => insert.run(...p));

console.log('Seeded.');