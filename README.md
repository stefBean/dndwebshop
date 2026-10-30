# Dice & Lore

A React and Tailwind fantasy webshop with reusable product cards, search, product details, a persistent cart, customer accounts, and simulated orders. The Express API stores products, password hashes, sessions, and orders in SQLite. Security challenges are intentionally outside this basic shop.

## Frontend

The catalogue uses a fixed three-column product grid, including narrow screens. Reusable `ProductCard`, `ProductDetails`, buttons, dialogs, icons, and quantity controls live in `client/src/components`. Pages are routed with React Router; `ShopProvider` shares the catalogue, signed-in account, and cart. Tailwind CSS is integrated through the Vite plugin, with theme tokens in `client/src/index.css`. All seven fantasy illustrations are local SVGs and need no external image service.

Search matches product names, descriptions, and categories as plain text. Category filters, price/name sorting, quick-view dialogs, product detail routes, quantity editing, empty/error states, registration, login/logout, and private order history are included. Challenge routes and intentionally vulnerable behaviors are not implemented.

## Local development

Use Node.js 24 (the configured cloud runtime) or a compatible current Node.js release meeting the package engine requirements.

```sh
cd client
npm ci
npm run build
cd ../server
npm ci
npm start
```

The API runs on port 3001 and serves the built frontend. For frontend development, run `npm run dev` in `client` in a second terminal; Vite proxies `/api` to the backend. By default the SQLite file is `server/shop.db` when the backend starts from `server`. Set `DB_PATH` to an absolute path for another location and `PORT` to override the API port.

The database initializes automatically. `npm run seed` in `server` is an idempotent initialization command; it does not erase orders, accounts, stock, or custom products. The original unchanged generic starter catalogue is migrated to the six fantasy products. Other existing catalogue data is preserved.

## Development accounts

In development only, two fictitious customer accounts are available:

| Email | Password |
| --- | --- |
| `aria@diceandlore.test` | `RollForAdventure!24` |
| `finn@diceandlore.test` | `RollForAdventure!24` |

Customers can also create their own accounts. Passwords require 12–128 characters with uppercase, lowercase, and a number. Passwords are salted and hashed with scrypt; raw passwords are never stored. Sessions use random opaque tokens in HttpOnly, SameSite=Lax cookies. Only token hashes are stored server-side. Sessions expire after 24 hours and are invalidated on logout. Login and registration share a limit of eight attempts per IP in two minutes.

With `NODE_ENV=production`, demo accounts are not created and existing demo accounts cannot authenticate. Production session cookies require HTTPS. Run behind an HTTPS reverse proxy that preserves the request Host and Origin. The application rejects cross-origin mutation requests and provides no cross-origin API grant. Configure deployment ingress and TLS for the actual hostname before publishing a public instance.

## Cart and orders

The browser cart stores only product IDs and integer quantities. Names, prices, and availability come from the API. Checkout requires authentication and is clearly a simulation: it never charges money or initiates shipping. The backend validates quantity and stock, calculates totals from SQLite prices, saves order-line snapshots, and reduces stock atomically. Order history is filtered to the signed-in customer's account.

## Validation

```sh
cd client
npm run build
npm run lint
cd ../server
npm test
```

Backend integration tests run against isolated temporary databases and cover catalogue data, login/logout/session expiry, registration, rate limiting, request validation, stock and authoritative prices, persisted orders, account isolation, production demo-account exclusion, and non-destructive initialization. Tests listen on temporary loopback ports; sandboxed execution may require the environment's supported local-network permission flow.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/products` | Full catalogue; optional `search` query |
| GET | `/api/products/:id` | Product details or 404 |
| GET | `/api/auth/me` | `{ user }`, null when signed out |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/logout` | Invalidate session, return 204 |
| GET | `/api/orders` | Signed-in customer's order history |
| POST | `/api/orders` | `{ items: [{ product_id, quantity }] }`; create simulated order |

JSON mutation requests must use `Content-Type: application/json`, except the bodyless logout request. Errors return `{ error }` with the appropriate HTTP status. Product and order prices use integer euro cents.
