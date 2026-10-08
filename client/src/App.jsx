import { useEffect, useState } from 'react';

export default function App() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch('/api/products').then((r) => r.json()).then(setProducts);
  }, []);

  return (
      <div>
        <h1>Webshop</h1>
        <ul>
          {products.map((p) => (
              <li key={p.id}>{p.name}: {(p.price_cents / 100).toFixed(2)} €</li>
          ))}
        </ul>
      </div>
  );
}