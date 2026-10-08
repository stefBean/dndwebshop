import express from 'express';
import { db } from './db.js';
import path from 'node:path';

const app = express();
app.use(express.json());

app.get('/api/products', (req, res) => {
    res.json(db.prepare('SELECT id, name, price_cents FROM products').all());
});

app.get('/api/products/:id', (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
});

const clientDist = path.resolve(import.meta.dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Shop on port ${port}`));