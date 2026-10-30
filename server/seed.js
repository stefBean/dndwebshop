import { openDatabase } from './db.js';

// Initialization is idempotent; existing customer data and stock are preserved.
const db = openDatabase();
console.log(`Catalog ready: ${db.prepare('SELECT COUNT(*) AS count FROM products').get().count} products.`);
db.close();
