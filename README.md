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

# Dungeons & Dragons Shop

A university webshop featuring three OWASP Top 10:2025 security challenges.

**Tech stack:** React, Node.js, Express, SQLite, Docker Compose.

The shop includes product browsing, customer accounts, a shopping cart, simulated checkout and order history.

## 1. Access

The webshop is hosted on an Ubuntu VM using Proxmox.

| | Address |
|---|---|
| Webshop | http://dice-and-lore.hcw:8080 |
| Challenges | http://dice-and-lore.hcw:8080/challenges |
| Server IP | `10.13.26.24` |
| Access | HCW network / WireGuard |

All exercises must be performed within the designated challenge areas.

## 2. Start and Stop

Connect to the Ubuntu server via SSH.

```bash
cd ~/dndwebshop

# Start the shop
sudo docker compose up -d

# Check container status
sudo docker compose ps

# Stop the shop
sudo docker compose down
```

To deploy an updated version of `master`:

```bash
git switch master
git pull --ff-only origin master
sudo docker compose up --build -d --remove-orphans
```

The SQLite database is stored in a persistent Docker volume and is not deleted by a normal restart.

Do not use `docker compose down -v`, as this can delete stored data.

## 3. Test Account

A fictional customer account is available for testing the normal shopping process.

| Username | Password |
|---|---|
| `finn` | `RollForAdventure!24` |

Additional credentials for security exercises are provided separately to the instructor.

## 4. Security Challenges

Open `/challenges` to view the tasks.

| Challenge | Objective | Verification |
|---|---|---|
| Log Flood · CWE-779 | Investigate excessive logging | Audit-log status reaches the defined threshold |
| Weak Password | Demonstrate weak password protection | Successful login to the designated challenge account |
| DOM-XSS · CWE-80 | Execute JavaScript through product search | Visible execution in the isolated preview |

### Enable Challenges

Run these commands inside the project directory on the Ubuntu server:

**Weak Password**

```bash
sudo docker compose exec shop npm run challenge:set -- weak-password true
```

**Log Flood**

```bash
sudo docker compose exec shop npm run challenge:set -- log-flood true
```

**DOM-XSS**

The preview is available through the product search at `/products`. No additional activation is needed for the current preview implementation.

### Disable Challenges

```bash
sudo docker compose exec shop npm run challenge:set -- weak-password false
sudo docker compose exec shop npm run challenge:set -- log-flood false
```

Disabling a challenge does not necessarily reset its stored progress.

## 5. Reset

**Reset the audit log:**

```bash
sudo docker compose exec shop npm run audit:reset
```

**Full webshop reset:**

The verified shop-reset command must be added here. It must restore the documented starting state of products, test accounts, orders and carts.

Before repeating an exercise, follow the appropriate reset instructions.

## 6. Documentation for the Instructor

The repository contains the webshop source code and configuration.

The following information is provided separately to the instructor:

- Challenge solutions and reproducible verification steps
- CWE references, secure fixes and test scenarios
- Architecture and technology decisions
- Additional test credentials and the verified reset procedure

**Submission version:** Add the final tested Git commit or release tag here.

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


