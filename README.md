# Tayssir POS

Point of sale, inventory and sales reporting for small shops. It runs **in the browser, as an installable app (PWA) on desktop, tablet and phone, and as an offline desktop app**, all from one codebase.

> Version 2 is a full rewrite of the original Electron + Sequelize app (kept for reference in [`legacy/electron-app`](legacy/electron-app)). See [What changed](#what-changed-from-v1) below.

## Features

- **Point of sale**: barcode scanner support (USB/Bluetooth scanners in keyboard mode), product search and tap-to-add grid, line and ticket discounts, cash/card/other payments, change calculation, and 80 mm thermal receipt printing. The cart survives a page refresh.
- **Customers and credit sales**: sell on account or take a partial payment, per-customer credit limits, balances, payments received and a printable account statement.
- **Returns and refunds**: partial or full returns of a sale, refund in cash, card or to the customer's account, with or without putting the items back in stock. A sale that has returns can no longer be voided.
- **Suppliers and purchases**: receive stock from suppliers, update cost prices with a weighted average, track what you owe and record supplier payments.
- **Cash register shifts**: open a shift with a float, record cash in/out, and close with a counted amount; the Z report shows expected cash, the difference, sales by payment method, refunds and credit collected. Shifts can be made mandatory before selling.
- **Products**: catalog with categories and brands, cost and sale prices with live margin, low-stock alerts, active/inactive products, unique in-store EAN-13 barcode generation, printable barcode labels, and stock adjustments with a full stock history.
- **Sales**: history with date, status and number filters, sale details, receipt reprint, and voiding a sale (which restores stock).
- **Reports**: revenue, cost, gross profit, margin, average ticket (all net of returns), a daily chart, top products, and sales by category and by payment method.
- **Import / export**: products, customers and suppliers as CSV (opens in Excel; `;` or `,` separators and decimal commas are accepted on import), and sales as CSV.
- **Backups**: automatic daily backup on local installs, a copy before every migration, manual backups, download, and restore from the settings screen.
- **Team**: administrator and cashier roles. Cashiers can sell and see their own sales; administrators manage everything.
- **Languages**: English, French and Arabic (right-to-left layout), plus light and dark mode.

## Tech stack

| Concern                | Choice                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework              | [Next.js 16](https://nextjs.org) (App Router, Cache Components, Turbopack), React 19, TypeScript                     |
| UI                     | [shadcn/ui](https://ui.shadcn.com) (Radix), Tailwind CSS v4, lucide icons, Recharts                                  |
| Data fetching / tables | [TanStack Query](https://tanstack.com/query) and [TanStack Table v9](https://tanstack.com/table)                     |
| API                    | [Hono](https://hono.dev) REST API at `/api/*` with zod validation and a typed RPC client                             |
| Database               | [Drizzle ORM](https://orm.drizzle.team) with libSQL/SQLite: a local file or [Turso](https://turso.tech) in the cloud |
| Auth                   | [Better Auth](https://better-auth.com): username login, sessions, admin/cashier roles                                |
| Forms                  | react-hook-form + zod (the same schemas validate on the server)                                                      |
| i18n                   | next-intl (en / fr / ar with RTL)                                                                                    |
| Desktop                | PWA install, or the Electron shell in `apps/desktop` for offline single-PC shops                                     |
| Tests                  | Vitest                                                                                                               |

## Repository layout

```
apps/
  web/        Next.js app: UI + API + database (this is the product)
  desktop/    Thin Electron shell that runs apps/web locally (offline)
legacy/
  electron-app/   The original v1 application, for reference only
```

Inside `apps/web/src`:

```
app/[locale]/        Routes: (auth)/login|setup|signup, (app)/dashboard|pos|products|sales|customers|
                     suppliers|purchases|shifts|reports|settings
app/api/[[...route]] Mounts the Hono API
server/              Server-only code
  db/                Drizzle schema, client, migrations runner, seed
  services/          Business logic (products, sales, reports…), unit-tested
  api/               Hono routes, auth middleware, error handling
  licensing/         Signed license and subscription tokens, activation server
  sync/              Change log, push/pull sync between desktop installs and the cloud
  cli/admin.ts       Vendor command line (keys, licenses, subscriptions)
  auth.ts            Better Auth configuration
features/            UI by domain (pos, products, sales, reports, settings…)
components/ui/       shadcn/ui components
lib/validators       zod schemas shared by API, forms and future mobile clients
messages/            Translations (en, fr, ar)
```

## Getting started

Requirements: Node.js 20.9+ (22 recommended).

```sh
npm install
cp apps/web/.env.example apps/web/.env.local   # optional in development
npm run dev
```

Open http://localhost:3000. On first launch you are taken to **setup**, where you create the store and the administrator account. Database migrations run automatically when the server starts. The database lives in `apps/web/data/tayssir.db` by default.

Optional demo data: `npm run db:seed`.

### Useful scripts

| Command                                           | Description                                                |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                                     | Start the web app in development                           |
| `npm run build` / `npm start`                     | Production build / server                                  |
| `npm run lint` / `npm run typecheck` / `npm test` | Quality checks (also run in CI)                            |
| `npm run db:generate -w @tayssir/web`             | Generate a migration after editing `schema.ts`             |
| `npm run db:studio -w @tayssir/web`               | Browse the database with Drizzle Studio                    |
| `npm run admin -w @tayssir/web -- <command>`      | Vendor CLI, see [Licensing](#business-model-and-licensing) |

## Deployment modes

The same app runs in one of two modes, chosen with `TAYSSIR_MODE`:

|                | `local` (default)                                 | `cloud`                                   |
| -------------- | ------------------------------------------------- | ----------------------------------------- |
| Used for       | Desktop app, a shop server on the local network   | Your hosted SaaS                          |
| Stores         | One store per install, created by first-run setup | Many stores; public sign-up at `/signup`  |
| Access control | Offline license (or 14-day trial)                 | Subscription per store (14-day trial)     |
| Extra role     | Can link to a cloud store and sync                | License activation server and sync server |

## Business model and licensing

Both models are supported, and they share one set of keys:

- **Offline license (desktop)**: you sell a license key. The shop activates it once online (Settings → License); the desktop then works offline. Each license has a device limit and an optional expiry.
- **Cloud subscription (SaaS)**: each store signs up on your cloud deployment and gets a 14-day trial; you then set its subscription. A desktop install linked to a cloud store is covered by that store's subscription, so a subscriber does not also need a license.

When access lapses, the app switches to **read-only**: sales, products and other changes are refused, but browsing, reports, exports and backups still work, so a shop never loses its data.

Licenses and subscriptions are Ed25519-signed tokens. The private key stays on your cloud server; desktops only hold the public key, so they verify tokens offline and cannot forge them. Activation is bound to a machine fingerprint.

Vendor operations run against the cloud database. In the Docker image the CLI is bundled: `docker exec -it tayssir node admin.mjs <command>` (same commands as below). From a checkout, run them from `apps/web` with `DATABASE_URL` set:

```sh
npm run admin -- keys:generate                      # once: prints LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY
npm run admin -- license:create --plan pro --devices 2 --days 365 --customer "Superette X"
npm run admin -- license:list
npm run admin -- license:revoke <id|last 4 chars>
npm run admin -- license:reset <id|last 4 chars>   # frees its device slots (new PC)
npm run admin -- store:list
npm run admin -- store:subscription <storeId> --status active --plan pro --until 2027-01-31
npm run admin -- platform:admin <username> --name "Your Name"   # console account
npm run admin -- platform:2fa-reset <username>                  # lost authenticator
```

Subscription payments are not connected to a payment provider yet: record them in the [platform console](#platform-console) (or call the same service from a payment webhook later).

Desktops check their license in with the server every 12 hours when online: renewals and plan changes reach them, and a revoked license or a freed device slot takes effect at the next check-in.

Without `LICENSE_PUBLIC_KEY`, a local install is unlicensed and unrestricted, which is handy for development or for your own shop.

## Platform console

On the cloud deployment, the owner of the SaaS manages everything at `/platform`:

- **Overview**: monthly recurring revenue, revenue this month and per month, paying and active stores, new sign-ups, and the stores that need attention (trials ending, renewals due, recently lapsed).
- **Stores**: search and filter by status; per store: subscription, usage totals, users, linked desktops, payments and history. Actions: record a payment (renews the subscription from the end of the paid period), change the subscription, extend the trial, suspend or reactivate (a suspended store is read-only, on the web and on its desktops), reset a user's password.
- **Licenses**: create (the key is shown once), edit plan/devices/end date, revoke or restore, free one or all PCs, record a payment (extends a dated license).
- **Devices**: every linked desktop with its store, app version and last sync; "not syncing" after 3 days; revoke.
- **Payments**: all payments with filters and totals; void a mistaken one (kept in the history, excluded from revenue).
- **Audit log**: every change made in the console or with the CLI, with who, when and from which IP.

The console only shows store totals, never a store's sales, customers or products.

Access is limited to accounts that have the `platform` role, belong to no store **and** are listed in `PLATFORM_ADMINS`. Anyone else gets a 404. Two-step verification (authenticator app, with backup codes) is required, and console sessions expire after 12 hours. To set it up:

```sh
# On the cloud server (Docker; or `npm run admin --` from apps/web):
docker exec -it tayssir node admin.mjs platform:admin yourname --name "Your Name"   # prints a temporary password
# Add PLATFORM_ADMINS=yourname to the server environment and restart, then
# sign in at /login and follow the authenticator setup.
```

Payment amounts use `PLATFORM_CURRENCY` (default `DZD`).

## Cloud sync for desktop installs

A desktop install can be linked to a store on your cloud deployment (Settings → Sync, with the cloud administrator's username and password). After linking:

- The desktop keeps working fully offline and syncs in the background every minute (`SYNC_INTERVAL_MS`) and on demand.
- Data goes both ways: products and prices edited on the web reach the shop, and sales made in the shop appear on the web, in reports and on other linked devices.
- The local data is uploaded on the first link, under the cloud store.
- Each device gets a short code, and receipt numbers are prefixed with it (`D1-42`, web sales `W-7`), so numbers never collide.
- Administrators see and revoke devices from Settings → Sync on the cloud.

How it works: SQLite triggers record every change in a local change log; the desktop pushes it and pulls the cloud's changes since its last cursor. Rows have UUIDv7 ids and are soft-deleted, so they merge without conflicts; when the same row is edited in two places, the latest edit wins. Stock is not synced as a number: every stock change is a movement, and each side recomputes stock from the movements, so offline sales from several tills add up correctly.

Limitations to be aware of:

- "Latest edit wins" relies on device clocks, so keep them roughly correct.
- Two offline tills can both sell the last unit; stock then goes negative and shows up in low-stock alerts.
- Users are not synced: each install keeps its own accounts.

## Backups and restore

Local installs back up the database every day and before every migration into a `backups` folder next to the database (the 30 most recent are kept). From Settings → Backup you can create, download and restore a backup; a copy of the current data is taken before restoring. The restore is applied when the server restarts, which the desktop app does by itself. With Docker, run the container with `--restart unless-stopped`. On cloud deployments, use your database provider's backups (Turso point-in-time restore, volume snapshots).

## Deployment options

### 1. Desktop app (offline, single PC)

```sh
npm run dist:win -w @tayssir/desktop    # or dist:mac / dist:linux
```

The installer bundles the web app and starts it on `localhost` with a local SQLite database stored in the user's app-data folder (`%APPDATA%/Tayssir POS` on Windows). Nothing needs to be installed or configured. To let tablets or phones on the shop's network use the same data, start it with `TAYSSIR_HOST=0.0.0.0` and `TAYSSIR_PORT=3000`.

**Releases and auto-update.** Push a tag such as `desktop-v2.1.0` (matching `version` in `apps/desktop/package.json`). The `Release desktop` workflow builds Windows, macOS and Linux installers and publishes them to GitHub Releases. Installed apps check for updates at launch and every 6 hours, download in the background and offer to restart. Configure in the repository settings:

| Name                           | Kind               | Purpose                                                          |
| ------------------------------ | ------------------ | ---------------------------------------------------------------- |
| `LICENSE_PUBLIC_KEY`           | Secret             | Built into the app to verify licenses                            |
| `LICENSE_SERVER_URL`           | Variable           | Your cloud URL, for activation and sync                          |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | Secrets (optional) | Code signing certificate (base64 `.p12`/`.pfx`) and its password |

Unsigned builds work, but Windows SmartScreen warns on first install, and macOS auto-update needs a signed (and notarized) app.

### 2. Shop server or cloud (Docker)

```sh
docker build -t tayssir-pos .
docker run -d --name tayssir --restart unless-stopped -p 3000:3000 -v tayssir-data:/data \
  -e TAYSSIR_MODE=cloud \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL=https://pos.example.com \
  -e LICENSE_PRIVATE_KEY=... -e LICENSE_PUBLIC_KEY=... \
  tayssir-pos
```

Use `TAYSSIR_MODE=local` (the default) for a single shop server on the local network.

### 3. Serverless (e.g. Vercel) + Turso

Set `DATABASE_URL=libsql://<db>.turso.io`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, plus `TAYSSIR_MODE=cloud` and the license keys for a SaaS.

Each device (desktop, tablet or phone) can then **install the app** from the browser ("Install app" / "Add to Home Screen").

### Environment variables

| Variable                        | Default                  | Notes                                                         |
| ------------------------------- | ------------------------ | ------------------------------------------------------------- |
| `TAYSSIR_MODE`                  | `local`                  | `local` or `cloud`, see [Deployment modes](#deployment-modes) |
| `DATABASE_URL`                  | `file:./data/tayssir.db` | SQLite file or libSQL/Turso URL                               |
| `DATABASE_AUTH_TOKEN`           |                          | Turso token                                                   |
| `BETTER_AUTH_SECRET`            |                          | **Required in production**, 32+ random characters             |
| `BETTER_AUTH_URL`               |                          | Public URL of the app                                         |
| `LICENSE_PRIVATE_KEY`           |                          | Cloud only, secret: signs licenses and subscriptions          |
| `LICENSE_PUBLIC_KEY`            |                          | Verifies them; without it, local installs are not licensed    |
| `LICENSE_SERVER_URL`            |                          | Local: the cloud deployment used for activation and sync      |
| `SYNC_INTERVAL_MS`              | `60000`                  | Local: background sync interval                               |
| `MIGRATIONS_DIR`                |                          | Override the migrations folder (set by the desktop app)       |
| `TAYSSIR_HOST` / `TAYSSIR_PORT` | `127.0.0.1` / random     | Desktop app: where the local server listens                   |

## Mobile app (later)

The API is a plain REST API under `/api/*`, validated with the zod schemas in `src/lib/validators`. A future React Native / Expo app in `apps/mobile` can reuse those schemas and the typed Hono client (`hc<AppType>`), and sign in with the Better Auth Expo client. No backend changes are needed.

## What changed from v1

Issues in the original codebase that the rewrite fixes:

| v1 problem                                                                                                                                | v2                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Login state lived only in React state/`localStorage`; any user id could be forged                                                         | Server-side sessions (Better Auth, httpOnly cookies); every API call is authorized on the server |
| Preload exposed Node's `fs`, `os` and `crypto` to the page (`sandbox: false`), undoing context isolation                                  | No Node APIs in the UI; the desktop window is sandboxed and only loads the local app             |
| License key = SHA-256 of hardware serials, checked in the renderer (trivially forgeable), and a real key was committed (`licenseKey.txt`) | Server-issued, Ed25519-signed licenses verified on the server, with device limits and revocation |
| Sales trusted prices sent by the renderer                                                                                                 | The server prices every sale from the catalog                                                    |
| Sale lines and stock updates ran in `Promise.all` without a transaction; stock could go negative; concurrent sales could oversell         | One database transaction per sale, with a conditional stock decrement that refuses to oversell   |
| A "sale" was one row per product, with no ticket, payment or totals                                                                       | Proper `sales` + `sale_items` with price/cost snapshots, payment method, change and voiding      |
| No audit of stock changes                                                                                                                 | `stock_movements` records every change (initial, sale, void, adjustment)                         |
| Barcode generated from the product name (collisions, invalid codes)                                                                       | Random in-store EAN-13 with a valid check digit, checked for uniqueness                          |
| IPC listeners were re-registered on every request (memory leak, duplicate handlers); the login error reply had no channel                 | Typed HTTP API with TanStack Query (caching, retries, invalidation)                              |
| `sequelize.sync({ alter: true })` on every launch; relative DB path; production pointed to a MySQL placeholder                            | Versioned Drizzle migrations applied at startup; DB location set by configuration                |
| Prices as floats/ints without a unit                                                                                                      | Integer minor units (e.g. centimes) with currency-aware formatting                               |
| Users could sign up freely from the login screen                                                                                          | First-run setup creates the admin; after that, only admins create users                          |
| DevTools always opened in production; duplicate/dead files (`Loginnnn.jsx`, `* copy.jsx`, screens copied into `assets/i18n`)              | Clean, typed, linted and tested codebase with CI                                                 |
| README described PostgreSQL, which the app did not use                                                                                    | Accurate documentation                                                                           |

## License

MIT
