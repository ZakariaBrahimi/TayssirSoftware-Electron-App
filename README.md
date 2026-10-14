# Tayssir POS

Point of sale, inventory and sales reporting for small shops. It runs **in the browser, as an installable app (PWA) on desktop, tablet and phone, and as an offline desktop app**, all from one codebase.

> Version 2 is a full rewrite of the original Electron + Sequelize app (kept for reference in [`legacy/electron-app`](legacy/electron-app)). See [What changed](#what-changed-from-v1) below.

## Features

- **Point of sale**: barcode scanner support (USB/Bluetooth scanners in keyboard mode), product search and tap-to-add grid, line and ticket discounts, cash/card/other payments, change calculation, and 80 mm thermal receipt printing. The cart survives a page refresh.
- **Products**: catalog with categories and brands, cost and sale prices with live margin, low-stock alerts, active/inactive products, unique in-store EAN-13 barcode generation, printable barcode labels, and stock adjustments with a full stock history.
- **Sales**: history with date, status and number filters, sale details, receipt reprint, and voiding a sale (which restores stock).
- **Reports**: revenue, cost, gross profit, margin, average ticket, a daily chart, top products, and sales by category and by payment method.
- **Dashboard**: today's KPIs, the last 30 days, low stock and recent sales.
- **Team**: administrator and cashier roles. Cashiers can sell and see their own sales; administrators manage everything.
- **Languages**: English, French and Arabic (right-to-left layout), plus light and dark mode.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components, Turbopack), React 19, TypeScript |
| UI | [shadcn/ui](https://ui.shadcn.com) (Radix), Tailwind CSS v4, lucide icons, Recharts |
| Data fetching / tables | [TanStack Query](https://tanstack.com/query) and [TanStack Table v9](https://tanstack.com/table) |
| API | [Hono](https://hono.dev) REST API at `/api/*` with zod validation and a typed RPC client |
| Database | [Drizzle ORM](https://orm.drizzle.team) with libSQL/SQLite: a local file or [Turso](https://turso.tech) in the cloud |
| Auth | [Better Auth](https://better-auth.com): username login, sessions, admin/cashier roles |
| Forms | react-hook-form + zod (the same schemas validate on the server) |
| i18n | next-intl (en / fr / ar with RTL) |
| Desktop | PWA install, or the Electron shell in `apps/desktop` for offline single-PC shops |
| Tests | Vitest |

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
app/[locale]/        Routes: (auth)/login, (auth)/setup, (app)/dashboard|pos|products|sales|reports|settings
app/api/[[...route]] Mounts the Hono API
server/              Server-only code
  db/                Drizzle schema, client, migrations runner, seed
  services/          Business logic (products, sales, reports…), unit-tested
  api/               Hono routes, auth middleware, error handling
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

| Command | Description |
| --- | --- |
| `npm run dev` | Start the web app in development |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` / `npm test` | Quality checks (also run in CI) |
| `npm run db:generate -w @tayssir/web` | Generate a migration after editing `schema.ts` |
| `npm run db:studio -w @tayssir/web` | Browse the database with Drizzle Studio |

## Deployment options

### 1. Desktop app (offline, single PC)

```sh
npm run dist:win -w @tayssir/desktop    # or dist:mac / dist:linux
```

The installer bundles the web app and starts it on `localhost` with a local SQLite database stored in the user's app-data folder (`%APPDATA%/Tayssir POS` on Windows). Nothing needs to be installed or configured. To let tablets or phones on the shop's network use the same data, start it with `TAYSSIR_HOST=0.0.0.0` and `TAYSSIR_PORT=3000`.

### 2. Shop server or cloud (Docker)

```sh
docker build -t tayssir-pos .
docker run -d -p 3000:3000 -v tayssir-data:/data \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL=https://pos.example.com \
  tayssir-pos
```

### 3. Serverless (e.g. Vercel) + Turso

Set `DATABASE_URL=libsql://<db>.turso.io`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.

Each device (desktop, tablet or phone) can then **install the app** from the browser ("Install app" / "Add to Home Screen").

### Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `file:./data/tayssir.db` | SQLite file or libSQL/Turso URL |
| `DATABASE_AUTH_TOKEN` |  | Turso token |
| `BETTER_AUTH_SECRET` |  | **Required in production**, 32+ random characters |
| `BETTER_AUTH_URL` |  | Public URL of the app |

## Mobile app (later)

The API is a plain REST API under `/api/*`, validated with the zod schemas in `src/lib/validators`. A future React Native / Expo app in `apps/mobile` can reuse those schemas and the typed Hono client (`hc<AppType>`), and sign in with the Better Auth Expo client. No backend changes are needed.

## What changed from v1

Issues in the original codebase that the rewrite fixes:

| v1 problem | v2 |
| --- | --- |
| Login state lived only in React state/`localStorage`; any user id could be forged | Server-side sessions (Better Auth, httpOnly cookies); every API call is authorized on the server |
| Preload exposed Node's `fs`, `os` and `crypto` to the page (`sandbox: false`), undoing context isolation | No Node APIs in the UI; the desktop window is sandboxed and only loads the local app |
| License key = SHA-256 of hardware serials, checked in the renderer (trivially forgeable), and a real key was committed (`licenseKey.txt`) | Removed. Access is controlled by user accounts and roles |
| Sales trusted prices sent by the renderer | The server prices every sale from the catalog |
| Sale lines and stock updates ran in `Promise.all` without a transaction; stock could go negative; concurrent sales could oversell | One database transaction per sale, with a conditional stock decrement that refuses to oversell |
| A "sale" was one row per product, with no ticket, payment or totals | Proper `sales` + `sale_items` with price/cost snapshots, payment method, change and voiding |
| No audit of stock changes | `stock_movements` records every change (initial, sale, void, adjustment) |
| Barcode generated from the product name (collisions, invalid codes) | Random in-store EAN-13 with a valid check digit, checked for uniqueness |
| IPC listeners were re-registered on every request (memory leak, duplicate handlers); the login error reply had no channel | Typed HTTP API with TanStack Query (caching, retries, invalidation) |
| `sequelize.sync({ alter: true })` on every launch; relative DB path; production pointed to a MySQL placeholder | Versioned Drizzle migrations applied at startup; DB location set by configuration |
| Prices as floats/ints without a unit | Integer minor units (e.g. centimes) with currency-aware formatting |
| Users could sign up freely from the login screen | First-run setup creates the admin; after that, only admins create users |
| DevTools always opened in production; duplicate/dead files (`Loginnnn.jsx`, `* copy.jsx`, screens copied into `assets/i18n`) | Clean, typed, linted and tested codebase with CI |
| README described PostgreSQL, which the app did not use | Accurate documentation |

## License

MIT
