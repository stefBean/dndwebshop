# Dungeons & Dragons Shop

A React and Tailwind fantasy webshop with reusable product cards, search, product details, a persistent cart, customer accounts, and simulated orders. The Express API stores products, password hashes, sessions, and orders in SQLite. The CWE-779 logging challenge is isolated from the shop API; see [Security challenge](#security-challenge-cwe-779-logging-of-excessive-data).

## Frontend

The storefront uses a simple black-and-white interface with purple accents and full-color product artwork. Its responsive product grid shows one card per row on mobile, two on tablets, and three on desktop. Reusable layouts, navigation, product cards, product artwork, detail views, buttons, dialogs, form fields, notices, and order summaries live in `client/src/components`. Pages are routed with React Router; `ShopProvider` shares catalogue, account, and cart state. Tailwind CSS uses centralized theme tokens in `client/src/index.css`. All fantasy illustrations are local SVGs.

The homepage's reusable `AnimatedPotion` component renders moving purple liquid with CSS animations. Its pause/play control stops or resumes the animation; the system's reduced-motion preference displays a still version automatically. No animation library or external asset requests are required.


Search matches product names, descriptions, and categories as plain text. Category filters, price/name sorting, quick-view dialogs, product detail routes, quantity editing, empty/error states, registration, login/logout, and private order history are included. Intentionally vulnerable behavior is controlled by database-backed challenge flags, disabled by default (see below).

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

With `NODE_ENV=production`, ordinary demo accounts are excluded except for the existing
internal HTTP/demo configuration used by Compose. The dedicated password-challenge
target is managed separately by its explicit local activation command. Production session cookies require HTTPS. Run behind an HTTPS reverse proxy that preserves the request Host and Origin. The application rejects cross-origin mutation requests and provides no cross-origin API grant. Configure deployment ingress and TLS for the actual hostname before publishing a public instance.

## Cart and orders

The cart persists across navigation and browser reloads in `localStorage` under the unchanged key `dice-and-lore.cart.v1`, so existing saved carts remain compatible. The stored JSON groups `resetVersion` with an `items` array containing only product references and quantities. Legacy arrays remain readable before the first full reset. Normal reloads and navigation preserve carts; a changed server reset version invalidates them. IDs must be positive safe integers and quantities whole numbers from 1 to 99. Duplicate IDs are consolidated; malformed entries are ignored without losing valid items. `client/src/lib/cart-storage.js` owns parsing, sanitization, reading, and writing. If storage is blocked or full, the in-memory cart remains usable and the shop shows a notification.

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

No restart is required. Both `weak-password` and `log-flood` follow their explicit database flags even with NODE_ENV=production in this internal university exercise. There is no additional activation environment variable. Flags cannot be changed through public HTTP requests.
Use the same `DB_PATH` as the running server.

Inactive logging accepts at most 10 KB, writes metadata without headers or body,
limits requests to 30 per minute per IP, and rotates at 64 KiB. Active logging
accepts 1 MB bodies and retains full headers/body in the isolated challenge log,
with a 32 MiB application cap. Disabling a challenge does not erase previously
written sensitive challenge data; use the log reset command to clear it.

The password challenge uses a separate fictitious target with bcrypt cost 4.
Aria, Finn and registered customers retain their normal scrypt credentials.
The target is created only by the local activation command; existing accounts
are never adopted or overwritten. Disabling selects Argon2id and closes its backup.

The XSS exercise is implemented in the isolated `challenge-xss` preview service;
see [its operating instructions](challenge-xss/README.md).

## Password challenge: CWE-916

Open `/challenges` (linked in the main navigation and footer). The three expandable cards describe the existing XSS, offline password and log-flood exercises, including prerequisites and evidence. XSS requires manual browser reproduction; password and logging use their existing instance-wide status endpoints. All exercises take place in the existing shop. Start without a login
at `/robots.txt`. The page provides an endpoint-discovery list, a fictional password
wordlist and a local-only bcrypt verification script. It does not display the
complete endpoint, target hash or matching password.

Start the app first so its additive schema migration has run, then activate:

~~~sh
docker compose up --build -d
docker compose exec shop npm run challenge:set -- weak-password true
# Local development, after npm run dev:
npm --prefix server run challenge:set -- weak-password true
~~~

Commands use the running server's `DB_PATH` and need no restart. No additional
environment switch is required. Installation defaults to inactive.
Both database-controlled challenges may be explicitly activated in the internal production-mode deployment. This intentionally vulnerable university exercise must remain
behind the internal network boundary. Keep the loopback Docker binding or restrict
a chosen internal bind address with VPN/firewall. Do not expose it on the Internet.

`/api/challenges/weak-password/status` reports persisted completion after a successful
weak-hash target login. Progress is shared by this instance. Additionally show the
local offline-tool output as evidence of cracking.

Reset just this exercise, restoring active mode:

~~~sh
docker compose exec shop npm run reset:password-challenge
# Local:
npm --prefix server run reset:password-challenge
~~~

This restores the target hashes, clears progress and invalidates target sessions.
Other users, sessions, products, orders and challenges remain unchanged.
It is not a full shop reset; there is no public password-reset API.

Select the concrete safe variant:

~~~sh
docker compose exec shop npm run challenge:set -- weak-password false
# Local:
npm --prefix server run challenge:set -- weak-password false
~~~

The backup becomes unavailable and the target verifies only Argon2id (19 MiB,
two iterations, parallelism one). Mode changes revoke target sessions and clear
progress. Regular accounts stay on scrypt. An already known password can still
authenticate against its secure hash; the improvement is increased offline effort,
not immunity to a tiny known wordlist. See the
[OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

The unprotected backup is an additional access weakness, separate from CWE-916.
Only the dedicated ID-bound fixture can be exported; arbitrary queries, user
selection and SQLite/WAL/SHM downloads are unavailable.

The separate [teacher solution and patch scenarios](docs/teacher/weak-password.md)
are outside static web roots and excluded from the Docker build context.
Repository access must be managed separately from the playable application.

## Security challenge: CWE-779 logging of excessive data

The OWASP A09:2025 challenge is implemented in `server/challenge-log.js` and is
isolated from the normal shop API. When its flag is active, the challenge endpoint intentionally writes every header
and the complete request body to a dedicated log file, unredacted and without
rate limiting, up to the 32 MiB storage cap.

Endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/log.flood` | Accepts a JSON body and writes a challenge log entry |
| GET | `/api/challenges/log-flood/status` | Current log size and the 10 MB threshold |
| POST | `/api/challenges/log-flood/reset` | Truncates the challenge log only |

The log defaults to `/tmp/dice-lore-challenge/app.log` and can be changed with
`CHALLENGE_LOG_PATH`. `docker-compose.yml` mounts that directory as a 32 MiB
tmpfs, so a flood cannot fill the container or the persistent database volume.
Set `CHALLENGE_ADMIN_TOKEN` to require an `X-Challenge-Token` header on reset.

Reproduce the challenge (first run `npm run challenge:set -- log-flood true` from `server/`):

```sh
# Baseline size
curl -s localhost:3001/api/challenges/log-flood/status

# 250 requests with ~50 KB bodies
for i in $(seq 1 250); do
  curl -s -o /dev/null -X POST localhost:3001/api/log.flood \
    -H 'Content-Type: application/json' \
    --data "{\"text\":\"$(head -c 50000 /dev/zero | tr '\0' 'A')\"}"
done

# Size should now exceed the 10 MB threshold
curl -s localhost:3001/api/challenges/log-flood/status
```

Reset only the challenge log (database, sessions and orders are untouched):

```sh
docker compose exec shop npm run reset:challenge
# or, from server/: npm run reset:challenge
```

## Validation

```sh
npm run build
npm run lint
npm test
```

From the repository root, `npm test` runs the client cart-storage tests and all backend
integration tests, including the offline password challenge. Client checks cover persistence, reloads, malformed data, integer validation, deduplication, removal of injected account and price fields, and storage failures.

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
| POST | `/api/log.flood` | CWE-779 challenge logging endpoint |
| GET | `/api/challenges/log-flood/status` | Challenge log size and threshold |
| POST | `/api/challenges/log-flood/reset` | Truncate the challenge log |

JSON mutation requests must use `Content-Type: application/json`, except the bodyless logout request. Errors return `{ error }` with the appropriate HTTP status. Product and order prices use integer euro cents.

## Branding assets

The monochrome Dungeons & Dragons dragon-ampersand symbol is provided by [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/dungeonsanddragons.svg) under CC0 and is stored locally in `client/public/images/dnd-symbol.svg`. The shop wordmark is a local typographic composition inspired by the Dungeons & Dragons identity, with “Shop” added. Product illustrations remain in color.


## University operation and US08 full reset

This deployment is exclusively the authorized university exercise. No reset HTTP
endpoint exists. Run the following commands from the repository root; run each next
step only after the previous command succeeds. Do not delete database files or
Docker volumes.

### Start and activate the three exercises

Set a private CHALLENGE_ADMIN_TOKEN in the operator environment (or the local,
untracked .env) before starting. It protects the existing HTTP log-reset function;
never put the token in frontend files, source control or student instructions.
Without it, the existing log-reset endpoint is unprotected.

~~~sh
docker compose up --build -d
docker compose exec shop npm run challenge:set -- weak-password true
docker compose exec shop npm run challenge:set -- log-flood true
~~~

XSS has no switch: compose starts xss-preview alongside shop. Locally open
http://localhost:8080/products, and use http://localhost:8080/challenges for tasks.
The preview is on http://127.0.0.1:8081 (a deliberately different cookie host).
For student access over the university network, configure SHOP_BIND_IP,
XSS_BIND_IP, XSS_PREVIEW_ORIGIN and XSS_SHOP_ORIGINS for the assigned internal
addresses and two distinct browser-reachable hosts. Loopback URLs on a student's
machine do not point at the university server. Restrict access to the authorized
network; use matching HTTPS origins if terminating TLS. Recreate containers after
changing these environment values. Keep the existing preview sandbox, CSP,
network isolation and resource/storage limits.

### Status and individual resets

/challenges shows **Fortschritt dieser Instanz**, shared by all participants:
XSS requires manual proof of JavaScript execution; password uses the existing
successful-target-login record (offline tool evidence is additionally required);
logging uses actual sizeBytes >= thresholdBytes (10 MiB by default). Deactivated,
unconfigured and unreachable states are displayed separately. Status refreshes on
page load, return to the tab, and the refresh buttons.

~~~sh
curl http://localhost:8080/api/challenges/weak-password/status
curl http://localhost:8080/api/challenges/log-flood/status
docker compose exec shop npm run reset:password-challenge
docker compose exec shop npm run reset:challenge
~~~

The individual password reset intentionally restores active mode, as before.
The individual log reset only truncates the log. XSS resets by clearing the shop
search; it has no database, cookies or saved completion. Individual challenge
resets do not clear carts, orders or other accounts.

### Full reset: preflight, stop, reset, start

~~~sh
# Read-only preflight while the shop is still running:
docker compose exec shop npm run reset:shop -- --check
# Continue only if the preflight succeeds:
docker compose stop shop
docker compose run --rm --no-deps shop npm run reset:shop
docker compose up -d shop
~~~

The one-off reset container uses the same /data volume and database as shop.
The original shop must remain stopped until reset succeeds. A shared exclusive
operator lock prevents the running server and reset command from overlapping.
Logs are on volatile tmpfs: stopping/recreating the shop discards that container's
log; the reset also invokes the existing log.reset function. The one-off
container has its own tmpfs, so its empty log is not a way to clear a running
shop's log. Never use docker compose down -v for this procedure.

For local development (same DB_PATH and CHALLENGE_LOG_PATH as the server):

~~~sh
npm run reset:shop -- --check
# Stop npm run dev / npm start with Ctrl+C, then:
npm run reset:shop
npm run dev
~~~

The reset can be repeated. A stopped, initialized shop database is required;
preflight/reset never initializes an unknown file, seeds it or cleans sessions
before scope validation. If a crash/forced kill leaves *.operator.lock behind,
first verify that **all** shop and reset processes/containers using that database
are stopped. Only then remove that exact lock file (Docker: /data/shop.db.operator.lock;
local default: server/shop.db.operator.lock). Never remove a live lock. Restart or
retry the reset afterwards. Ordinary graceful shutdown removes the lock itself.

### Defined reset scope and resulting state

- Products: the six fixtures in server/data/products.json, including all original
  names, descriptions, prices, images, categories, tags and stock values. Newly
  seeded fixture IDs are recorded in reset_products. On migration, existing rows
  are adopted only when ID and descriptive identity match the fixtures; price
  and stock may differ due to exercise use. Registered fixture rows can later be
  restored even after edits or deletion. An unrelated product with a matching ID
  is not adopted merely by ID.
- Accounts: Aria/aria and Finn/finn, marked is_demo=1, with their documented demo
  password and original names; plus only the ID-bound fictitious password target
  when it was provisioned. Ordinary registered accounts are **not** automatically
  classified as test accounts. Unknown accounts, products, challenge rows or
  broken foreign-key relationships abort the reset before any destructive reset
  work. Resolve the data classification separately; there is no force-delete mode.
- All orders, order items and sessions of this validated fixture-only database
  are cleared. No foreign data is silently removed. Missing demo accounts are
  recreated; ID collisions with unmarked accounts cause an abort.
- Both challenge activation switches retain their previous values. The password
  target's fixture hashes and progress are reset using the existing function;
  a disabled, never-provisioned target stays unprovisioned. The log is empty.
  XSS has no persisted progress to reset.
- A new persistent resetVersion is committed with the database reset. Existing
  browsers clear only the shop cart on next load, focus/tab return or before a
  cart action/checkout. Tabs using the same origin also react to storage events.
  Closed/offline browsers synchronize on their next server contact. Other
  localStorage entries are preserved. Blocked storage still permits in-memory
  shopping; an unreachable version check blocks the action without deleting the cart.
- Products, login state, task status and page state are refreshed when a new
  version is detected. Old order confirmations/search frames are discarded.
  POST /api/orders requires X-Shop-Reset-Version; the version is checked inside
  the write transaction. Old or missing versions cannot create a new order,
  including after signing in again. Normal cart persistence remains unchanged
  when the version stays the same.

SQLite and a log file cannot commit atomically together. The server must stay
stopped during reset. If a log/filesystem/database error interrupts the command,
leave it stopped, resolve the error and repeat; do not report an unsuccessful
reset as completed. The command exits nonzero on failure.

### US08 acceptance checks

US08-AK1: the documented operator command restores the fixture catalogue/test
accounts, clears orders and invalidates browser carts through resetVersion.
US08-AK2: isolated tests verify login and a new valid checkout after reset, and
reject old cart generations even with a new session. US08-AK3: the commands,
prerequisites, scope and resulting state are documented above. Automated reset
checks use temporary/in-memory databases and temporary logs only; never run
destructive tests against server/shop.db or the university volume.

Optional real-browser regression (installed Chromium/Chrome, no extra npm package):

~~~sh
npm run build
npm run test:browser
~~~

Set CHROME_PATH to the installed browser executable when needed. Windows defaults
to the standard Google Chrome path; Linux defaults to chromium. Run as a regular
user with the browser sandbox available. This check creates two independent
browser contexts and another same-origin tab in a temporary profile. It verifies
cart preservation/invalidations, unrelated storage, status transitions and network
failures, login/checkout after reset, and actual JavaScript execution in the existing
XSS preview. All servers, database and logs are isolated from the shop instance.
