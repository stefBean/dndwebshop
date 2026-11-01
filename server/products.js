const columns = 'id, name, description, price_cents, category, image, tag, stock';
const allowedFields = new Set(['id', 'name', 'description', 'price_cents', 'category', 'image', 'tag', 'stock']);

export function getProducts(db, search = '') {
  return db.prepare(`SELECT ${columns} FROM products
    WHERE instr(lower(name || ' ' || coalesce(description, '') || ' ' || category), lower(?)) > 0
    ORDER BY id`).all(search);
}

export function getProduct(db, id) {
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value <= 0) return undefined;
  return db.prepare(`SELECT ${columns} FROM products WHERE id = ?`).get(value);
}

export function validateProducts(value) {
  if (!Array.isArray(value) || value.length > 10000) {
    throw new Error('Product data must be a JSON array containing at most 10000 products.');
  }
  const ids = new Set();
  return value.map((item, index) => {
    const fail = (message) => { throw new Error(`Product ${index + 1}: ${message}`); };
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('must be an object.');
    const unknown = Object.keys(item).find((key) => !allowedFields.has(key));
    if (unknown) fail(`unknown field "${unknown}".`);
    if (!Number.isSafeInteger(item.id) || item.id <= 0) fail('id must be a positive safe integer.');
    if (ids.has(item.id)) fail(`duplicate id ${item.id}.`);
    ids.add(item.id);
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 160) fail('name must contain 1–160 characters.');
    if (!Number.isSafeInteger(item.price_cents) || item.price_cents < 0 || item.price_cents > 1000000000) fail('price_cents must be an integer from 0 to 1000000000.');
    if (!Number.isSafeInteger(item.stock) || item.stock < 0 || item.stock > 1000000000) fail('stock must be an integer from 0 to 1000000000.');
    if (typeof item.category !== 'string' || !item.category.trim() || item.category.trim().length > 80) fail('category must contain 1–80 characters.');
    const description = item.description ?? '';
    const tag = item.tag ?? '';
    if (typeof description !== 'string' || description.length > 4000) fail('description must be text of at most 4000 characters.');
    if (typeof tag !== 'string' || tag.trim().length > 80) fail('tag must be text of at most 80 characters.');
    if (typeof item.image !== 'string' || item.image.length > 512 || !item.image.startsWith('/images/') || item.image.includes('\\')) {
      fail('image must be a local /images/ path of at most 512 characters.');
    }
    const imageUrl = new URL(item.image, 'http://localhost');
    if (!imageUrl.pathname.startsWith('/images/') || imageUrl.pathname !== item.image || imageUrl.search || imageUrl.hash) {
      fail('image must be a local /images/ path without traversal, query parameters, or a fragment.');
    }
    return {
      id: item.id,
      name: item.name.trim(),
      description,
      price_cents: item.price_cents,
      category: item.category.trim(),
      image: item.image,
      tag: tag.trim(),
      stock: item.stock,
    };
  });
}

export function importProducts(db, products, { overwrite = true } = {}) {
  // Validate the complete file before preparing any writes. The transaction also
  // rolls back previous rows if a database constraint rejects a later product.
  const rows = validateProducts(products);
  const insert = db.prepare(`INSERT INTO products (${columns})
    VALUES (@id, @name, @description, @price_cents, @category, @image, @tag, @stock)`);
  const update = db.prepare(`UPDATE products SET name=@name, description=@description,
    price_cents=@price_cents, category=@category, image=@image, tag=@tag, stock=@stock WHERE id=@id`);
  const exists = db.prepare('SELECT 1 FROM products WHERE id = ?');
  return db.transaction(() => {
    const result = { inserted: 0, updated: 0 };
    for (const row of rows) {
      if (exists.get(row.id)) {
        if (overwrite) { update.run(row); result.updated += 1; }
      } else { insert.run(row); result.inserted += 1; }
    }
    return result;
  })();
}
