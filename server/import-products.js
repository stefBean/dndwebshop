import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openDatabase } from './db.js';
import { importProducts, validateProducts } from './products.js';

let db;
try {
  const [filename, ...extra] = process.argv.slice(2);
  if (!filename || extra.length) throw new Error('Usage: npm run products:import -- path/to/products.json');
  // A bad file must not create, seed, or otherwise change the target database.
  const products = validateProducts(JSON.parse(readFileSync(path.resolve(filename), 'utf8')));
  db = openDatabase(undefined, { seedProducts: false });
  const result = importProducts(db, products);
  console.log(`Imported products: ${result.inserted} inserted, ${result.updated} updated. Other products were preserved.`);
} catch (error) {
  console.error(`Product import failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  db?.close();
}
