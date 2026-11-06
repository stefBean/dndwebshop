# Dungeons & Dragons Shop

A React and Tailwind fantasy webshop with reusable product cards, search, product details, a persistent cart, customer accounts, and simulated orders. The Express API stores products, password hashes, sessions, and orders in SQLite. The CWE-779 logging challenge is isolated from the shop API; see [Security challenge](#security-challenge-cwe-779-logging-of-excessive-data).

## Frontend

The storefront uses a simple black-and-white interface with purple accents and full-color product artwork. Its responsive product grid shows one card per row on mobile, two on tablets, and three on desktop. Reusable layouts, navigation, product cards, product artwork, detail views, buttons, dialogs, form fields, notices, and order summaries live in `client/src/components`. Pages are routed with React Router; `ShopProvider` shares catalogue, account, and cart state. Tailwind CSS uses centralized theme tokens in `client/src/index.css`. All fantasy illustrations are local SVGs.

The homepage's reusable `AnimatedPotion` component renders moving purple liquid with CSS animations. Its pause/play control stops or resumes the animation; the system's reduced-motion preference displays a still version automatically. No animation library or external asset requests are required.


Search matches product names, descriptions, and categories as plain text. Category filters, price/name sorting, quick-view dialogs, product detail routes, quantity editing, empty/error states, registration, login/logout, and private order history are included. Intentionally vulnerable behavior is controlled by database-backed challenge flags, disabled by default (see below).
=======

## Local development

Use Node.js 24 (the configured cloud runtime) or a compatible current Node.js release meeting the package engine requirements.

```sh
# Install once, from the repository root.
npm ci --prefix client
npm ci --prefix server

# Start both the API and frontend with one command.
cd client
npm run build:all
```

`npm run build:all` starts the API on port 3001 and Vite on port 5173 together. `npm run dev:all` in `client` is equivalent; `npm run dev` from the repository root also starts both. Press Ctrl+C to stop both processes. If either service fails, the other stops too. Vite uses a strict port so a conflict is reported instead of silently starting a second frontend. No additional launcher dependency is required.

The existing `npm run build` still creates production frontend assets; `build:all` is a convenience alias for starting development services. To serve the built frontend through Express, run `npm run build` from the repository root, then `npm start`.

Vite proxies `/api` to the backend. SQLite always defaults to `server/shop.db`, regardless of the command working directory. Set `DB_PATH` to an absolute path for another location; relative `DB_PATH` values resolve under `server/`. If `PORT` overrides the API port, Vite's proxy uses that same value. Additional Vite flags can be forwarded, for example `npm run build:all -- --host 0.0.0.0`.

The database initializes automatically. A new, empty database imports the starter products once from `server/data/products.json` and records that initialization. Existing product rows are never replaced during startup. Subsequent restarts preserve edited names, prices, images, stock, and even a deliberately empty catalogue. `npm run seed` in `server` is an idempotent initialization command; it does not restore deleted products or erase customer data.

## Product database

The product source of truth is the SQLite `products` table. React loads it through `GET /api/products`; product details, search, prices, availability, and checkout all read the stored rows. No product array is embedded in the frontend and no sample-data fallback is used for requests. The starter JSON is bootstrap/import data, not a live catalogue. Editing that file alone does not change an existing database.

To maintain the catalogue, edit `server/shop.db` with a SQLite editor or import a JSON file. For example, save this as a new file:

```json
[
  {
    "id": 7,
    "name": "Arcane Lantern",
    "description": "A lantern for your next dungeon expedition.",
    "price_cents": 1250,
    "category": "Gear",
    "image": "/images/adventurer-kit.svg",
    "tag": "New",
    "stock": 10
  }
]
```

From the repository root, import it using an absolute file path:

```sh
npm --prefix server run products:import -- /absolute/path/to/products.json
```

Matching IDs are updated; new IDs are inserted; products absent from the file are preserved. The complete file is validated before the database is opened, and writes are atomic. IDs must be positive integers, prices use integer euro cents, and stock is a nonnegative integer. Image paths refer to local assets in `client/public/images`. To intentionally import the starter data again, run `npm --prefix server run products:import -- data/products.json`; this explicit command updates the six starter IDs, including their stock, so use it only when desired.

Refresh the shop after importing or editing the database. Catalogue categories and counts come from the stored products. Docker retains the same database at `/data/shop.db` in the named volume. SQLite files, customer accounts, sessions, and orders are excluded from Git; share the import JSON rather than a live database.

## Development accounts

In development only, two fictitious customer accounts are available:

| Username | Password |
| --- | --- |
| `aria` | `RollForAdventure!24` |
| `finn` | `RollForAdventure!24` |

Customers can also create their own accounts. Passwords require 12–128 characters with uppercase, lowercase, and a number. Passwords are salted and hashed with scrypt; raw passwords are never stored. Sessions use random opaque tokens in HttpOnly, SameSite=Lax cookies. Only token hashes are stored server-side. Sessions expire after 24 hours and are invalidated on logout. Login and registration share a limit of eight attempts per IP in two minutes.

With `NODE_ENV=production`, demo accounts are not created and existing demo accounts cannot authenticate. Production session cookies require HTTPS. Run behind an HTTPS reverse proxy that preserves the request Host and Origin. The application rejects cross-origin mutation requests and provides no cross-origin API grant. Configure deployment ingress and TLS for the actual hostname before publishing a public instance.

## Cart and orders

The cart persists across navigation and browser reloads in `localStorage` under the unchanged key `dice-and-lore.cart.v1`, so existing saved carts remain compatible. The JSON format is only an array of product references and quantities, for example `[{"product_id":1,"quantity":2}]`. IDs must be positive safe integers and quantities whole numbers from 1 to 99. Duplicate IDs are consolidated; malformed entries are ignored without losing valid items. `client/src/lib/cart-storage.js` owns parsing, sanitization, reading, and writing. If storage is blocked or full, the in-memory cart remains usable and the shop shows a notification.

Names, prices, account details, passwords, and authentication tokens are never saved in the cart. Product information comes from the API and authentication remains a server-side session with an HttpOnly cookie. Checkout requires sign-in and is a simulation: it never charges money or initiates shipping. The backend validates quantities and stock, calculates authoritative totals, saves order-line snapshots, and reduces stock atomically. Order history belongs to the signed-in account.

## Safe and challenge modes

`challenges.active` is a SQLite boolean (`0` or `1`), read by `isActive(id)` on
requests. Both existing challenges default to inactive. Flags persist across
restarts and database initialization. Toggle them from the server directory:

```sh
npm run challenge:set -- log-flood true
npm run challenge:set -- weak-password true
# Return to safe behavior:
npm run challenge:set -- log-flood false
npm run challenge:set -- weak-password false
```

No restart is required. `NODE_ENV=production` always uses safe behavior,
regardless of stored flags. Flags cannot be changed through public HTTP requests.
Use the same `DB_PATH` as the running server.

Inactive logging records metadata only (no headers, no response body, query
string truncated) and rotates at 64 KiB. Active logging retains full request
headers and the complete catalogue response in the isolated audit log, with a
32 MiB application cap. Disabling the flag does not erase previously written
sensitive data; use the log reset command to clear it.

The weak-password flag enables MD5 verification only for the seeded Aria demo
account's separate `challenge_password_hash`. Its regular scrypt credential is
preserved, so turning the flag off immediately restores safe verification.
Finn and registered customers always use scrypt. Passwords are submitted to the
server for verification; serve the shop over HTTPS outside local development.
The DOM-XSS exercise runs in a sandboxed iframe at /xss-preview/ on the shop
origin, using the same container and port. See [the XSS guide](challenge-xss/README.md)
for single-IP deployment, payloads and isolation checks.

## Audit log: CWE-779 logging of excessive data

The OWASP A09:2025 issue is implemented in `server/audit-log.js` and is
triggered by ordinary shopping: every `GET /api/products` request is logged.
When the flag is active, the shop writes the full request headers (including the
session cookie) and the complete catalogue response to a dedicated log file,
unredacted and without rate limiting, up to the 32 MiB storage cap. A customer
browsing the catalogue therefore floods the log with data the shop never needs
to keep.

Endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/products` | Catalogue request; the audit log entry is written here |
| GET | `/api/audit-log/status` | Current log size and the 10 MB threshold |
| POST | `/api/audit-log/reset` | Truncates the audit log only |

The log defaults to `/tmp/dice-lore-audit/app.log` and can be changed with
`AUDIT_LOG_PATH`. `docker-compose.yml` mounts that directory as a 32 MiB
tmpfs, so a flood cannot fill the container or the persistent database volume.

Reproduce the issue (first run `npm run challenge:set -- log-flood true` from `server/`):

```sh
# Baseline size
curl -s localhost:3001/api/audit-log/status

# Browse the catalogue repeatedly, like a scraper would
for i in $(seq 1 3000); do
  curl -s -o /dev/null localhost:3001/api/products
done

# Size should now exceed the 10 MB threshold
curl -s localhost:3001/api/audit-log/status
```

Each entry is roughly 3.5 KB, so about 3000 catalogue requests reach the 10 MB
goal. Inspect the leaked data with `tail -1 /tmp/dice-lore-audit/app.log`.

Reset only the audit log (database, sessions and orders are untouched):

```sh
docker compose exec shop npm run audit:reset
# or, from server/: npm run audit:reset
```

## Validation

```sh
npm run build
npm run lint
npm test
```

From the repository root, `npm test` runs 10 client cart-storage tests followed by 22 backend integration tests. Client checks cover persistence, reloads, malformed data, integer validation, deduplication, removal of injected account and price fields, and storage failures.

Backend integration tests run against isolated temporary databases and cover product import validation and rollback, database-backed API responses, persistence across restarts, one-time seeding, stable database paths, literal SQL search, catalogue data, login/logout/session expiry, registration, rate limiting, request validation, stock and authoritative prices, persisted orders, account isolation, production demo-account exclusion, non-destructive initialization, and the CWE-779 challenge (unlimited logging and reset). Tests listen on temporary loopback ports; sandboxed execution may require the environment's supported local-network permission flow.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/products` | Full catalogue; optional `search` query |
| GET | `/api/products/:id` | Product details or 404 |
| GET | `/api/auth/me` | `{ user }`, null when signed out |
| POST | `/api/auth/login` | `{ username, password }` |
| POST | `/api/auth/register` | `{ name, username, password }` |
| POST | `/api/auth/logout` | Invalidate session, return 204 |
| GET | `/api/orders` | Signed-in customer's order history |
| POST | `/api/orders` | `{ items: [{ product_id, quantity }] }`; create simulated order |
| GET | `/api/audit-log/status` | Audit log size and threshold |
| POST | `/api/audit-log/reset` | Truncate the audit log |

JSON mutation requests must use `Content-Type: application/json`, except the bodyless logout request. Errors return `{ error }` with the appropriate HTTP status. Product and order prices use integer euro cents.

## Branding assets

The monochrome Dungeons & Dragons dragon-ampersand symbol is provided by [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/dungeonsanddragons.svg) under CC0 and is stored locally in `client/public/images/dnd-symbol.svg`. The shop wordmark is a local typographic composition inspired by the Dungeons & Dragons identity, with “Shop” added. Product illustrations remain in color.
