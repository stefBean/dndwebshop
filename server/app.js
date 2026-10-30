import express from 'express';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { hashPassword, hashPasswordSync, verifyPassword, tokenHash } from './security.js';

const cookieName = 'dice_lore_session';
const sessionLifetime = 24 * 60 * 60 * 1000;
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email });
const validId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

function cookieToken(req) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

export function createApp(db, { production = process.env.NODE_ENV === 'production' } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: production, path: '/' };
  const dummyHash = hashPasswordSync(randomBytes(24).toString('hex'));
  const attempts = new Map();

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      const origin = req.get('origin');
      if (origin) {
        try {
          const url = new URL(origin);
          if (url.host !== req.get('host') || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) {
            return res.status(403).json({ error: 'This request came from an untrusted origin.' });
          }
        } catch {
          return res.status(403).json({ error: 'Invalid request origin.' });
        }
      }
      if (req.method === 'POST' && req.path !== '/auth/logout' && !req.is('application/json')) {
        return res.status(415).json({ error: 'Send this request as application/json.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    const token = cookieToken(req);
    if (token) {
      const user = db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash(token), Date.now());
      if (user && !(production && user.is_demo)) req.user = publicUser(user);
    }
    next();
  });

  const requireUser = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    next();
  };
  const authLimit = (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = attempts.get(key);
    if (!entry || entry.until <= now) {
      if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value);
      entry = { count: 0, until: now + 120000 };
      attempts.set(key, entry);
    }
    if (entry.count >= 8) {
      res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many sign-in attempts. Please try again in two minutes.' });
    }
    entry.count += 1;
    next();
  };
  function startSession(req, res, user) {
    const previous = cookieToken(req);
    if (previous) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(previous));
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(tokenHash(token), user.id, Date.now() + sessionLifetime);
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLifetime });
  }

  app.get('/api/products', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 200) : '';
    const products = db.prepare('SELECT * FROM products ORDER BY id').all();
    res.json(search ? products.filter((product) => `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(search.toLowerCase())) : products);
  });
  app.get('/api/products/:id', (req, res) => {
    const product = validId(req.params.id) ? db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id)) : null;
    if (!product) return res.status(404).json({ error: 'This product could not be found.' });
    res.json(product);
  });

  app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid email address and password.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    const verified = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!user || !verified || (production && user.is_demo)) return res.status(401).json({ error: 'That email and password do not match.' });
    startSession(req, res, user);
    res.json({ user: publicUser(user) });
  });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ error: 'Enter a name between 2 and 80 characters.' });
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'Use 12–128 characters with uppercase, lowercase, and a number.' });
    }
    const normalized = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const result = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), normalized, passwordHash);
    if (!result.changes) return res.status(409).json({ error: 'An account with that email already exists. Please sign in.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    startSession(req, res, user);
    res.status(201).json({ user: publicUser(user) });
  });
  app.post('/api/auth/logout', (req, res) => {
    const token = cookieToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    res.clearCookie(cookieName, cookieOptions);
    res.sendStatus(204);
  });

  function orderDetails(order) {
    return { ...order, items: db.prepare('SELECT product_id, name, quantity, price_cents FROM order_items WHERE order_id = ? ORDER BY id').all(order.id) };
  }
  app.get('/api/orders', requireUser, (req, res) => {
    const orders = db.prepare('SELECT id, number, total_cents, created_at FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    res.json({ orders: orders.map(orderDetails) });
  });
  const placeOrder = db.transaction((userId, items) => {
    const rows = items.map((item) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw Object.assign(new Error('One of the products is no longer available. Please update your cart.'), { status: 400 });
      if (product.stock < item.quantity) throw Object.assign(new Error(`Only ${product.stock} of ${product.name} are available.`), { status: 409 });
      return { ...item, name: product.name, price_cents: product.price_cents };
    });
    const total = rows.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
    const number = `DL-${randomBytes(5).toString('hex').toUpperCase()}`;
    const result = db.prepare('INSERT INTO orders (number, user_id, total_cents) VALUES (?, ?, ?)').run(number, userId, total);
    for (const row of rows) {
      db.prepare('INSERT INTO order_items (order_id, product_id, name, quantity, price_cents) VALUES (?, ?, ?, ?, ?)')
        .run(result.lastInsertRowid, row.product_id, row.name, row.quantity, row.price_cents);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(row.quantity, row.product_id);
    }
    return orderDetails(db.prepare('SELECT id, number, total_cents, created_at FROM orders WHERE id = ?').get(result.lastInsertRowid));
  });
  app.post('/api/orders', requireUser, (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length || items.length > 100 || items.some((item) => !item || !Number.isSafeInteger(item.product_id) || item.product_id <= 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
      return res.status(400).json({ error: 'Your cart must contain products with whole-number quantities from 1 to 99.' });
    }
    if (new Set(items.map((item) => item.product_id)).size !== items.length) return res.status(400).json({ error: 'Each product must appear only once in your cart.' });
    res.status(201).json({ order: placeOrder(req.user.id, items) });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'This API endpoint does not exist.' }));
  const clientDist = path.resolve(import.meta.dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request contains invalid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}
