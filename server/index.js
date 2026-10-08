import express from 'express';
import { db } from './db.js';

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

app.listen(3001, () => console.log('API on http://localhost:3001'));