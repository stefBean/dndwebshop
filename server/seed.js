import { openDatabase } from './db.js';

// Initialization seeds a new empty database once. It never restores deleted rows
// or overwrites existing products, customer data, orders, or stock.
const db = openDatabase();
console.log(`Catalog ready: ${db.prepare('SELECT COUNT(*) AS count FROM products').get().count} products.`);
db.close();
