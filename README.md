# Dice & Lore

A React and Tailwind fantasy webshop with reusable product cards, search, product details, a persistent cart, customer accounts, and simulated orders. The Express API stores products, password hashes, sessions, and orders in SQLite. Security challenges are intentionally outside this basic shop.

## Frontend

The black fantasy storefront uses a responsive product grid: one card per row on mobile, two on tablets, and three on desktop. Reusable layouts, navigation, product cards, product artwork, detail views, buttons, dialogs, form fields, notices, and order summaries live in `client/src/components`. Pages are routed with React Router; `ShopProvider` shares catalogue, account, and cart state. Tailwind CSS uses centralized dark theme tokens in `client/src/index.css`. All fantasy illustrations are local SVGs.

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

The cart persists across navigation and browser reloads in `localStorage` under the unchanged key `dice-and-lore.cart.v1`, so existing saved carts remain compatible. The JSON format is only an array of product references and quantities, for example `[{"product_id":1,"quantity":2}]`. IDs must be positive safe integers and quantities whole numbers from 1 to 99. Duplicate IDs are consolidated; malformed entries are ignored without losing valid items. `client/src/lib/cart-storage.js` owns parsing, sanitization, reading, and writing. If storage is blocked or full, the in-memory cart remains usable and the shop shows a notification.

Names, prices, account details, passwords, and authentication tokens are never saved in the cart. Product information comes from the API and authentication remains a server-side session with an HttpOnly cookie. Checkout requires sign-in and is a simulation: it never charges money or initiates shipping. The backend validates quantities and stock, calculates authoritative totals, saves order-line snapshots, and reduces stock atomically. Order history belongs to the signed-in account.

## Validation

```sh
npm run build
npm run lint
npm test
```

From the repository root, `npm test` runs 10 client cart-storage tests followed by 10 backend integration tests. Client checks cover persistence, reloads, malformed data, integer validation, deduplication, removal of injected account and price fields, and storage failures.

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
