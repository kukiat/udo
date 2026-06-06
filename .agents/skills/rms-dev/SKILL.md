---
name: rms-dev
description: Run, seed, and work with the RMS (Restaurant Management System) app — a Next.js 15 + Socket.IO + Drizzle/Postgres full-stack project covering Self-Order, KDS, POS, Reports, Waitstaff, and Menu Management. Use whenever asked to start/run the app, reset or seed the database, log in with demo accounts, exercise the customer/KDS/dashboard flows, or run migrations.
---

# RMS Dev

Full-stack restaurant system: customer self-order, real-time KDS, POS, reports, and menu management. Next.js 15 App Router + a custom Socket.IO server, Drizzle ORM over Postgres (Supabase). UI is React Aria Components with a custom Codex-inspired Tailwind theme.

See `AGENTS.md` for the complete spec, `docs/FEATURES.md` for the implemented feature list, and `docs/ROLES.md` for the role-by-role breakdown.

## User roles & access

Access is defined in `AREA_ROLES` (`src/lib/auth.ts`), enforced by `requireAccess()` (`src/lib/guard.ts`) + the cookie gate in `src/middleware.ts`. Owner/admin reach everything.

| Role | Demo login | Access | Lands on |
|---|---|---|---|
| **Customer** | — (public, QR/link) | Storefront only | `/order/:branchId/:tableNo` |
| **Owner** | — | Everything | `/dashboard` |
| **Admin** | admin@demo.test | Everything | `/dashboard` |
| **Branch Manager** | manager@demo.test | Dashboard, Reports, KDS, Waitstaff | `/dashboard` |
| **Cashier** | cashier@demo.test | POS | `/pos/:branchId` |
| **Kitchen Staff** | kitchen@demo.test | KDS | `/kds/:branchId` |
| **Waitstaff** | waiter@demo.test | Waitstaff | `/waitstaff` |

## Modules & functionality

- **Customer Self-Order** (public) — QR/link entry scoped to one branch+table; browse menu by category; item detail with option groups/add-ons; cart (localStorage per `branchId:tableNo`) with quantities and notes; place order; real-time status (cancel while `pending`); bill with per-session totals + "request check".
- **Kitchen Display (KDS)** — real-time per-branch board, FIFO; station filter tabs (All/Hot/Cold/Drinks); advance `pending → preparing → ready → served`; cancel with reason; overdue alerts (~15 min); per-branch screen limit (`maxKdsScreens`, default 3) with live "Screen N of M" count + rejection screen.
- **Menu Management (Dashboard)** — restaurants & branches CRUD (settings: max KDS, VAT %, service %); categories with sort order + sub-categories; menu items via dynamic form (nested option groups/items inline, one request); status toggle (available/sold_out/hidden), soft delete, KDS station assignment, image upload; per-branch availability + price override (bulk save).
- **POS** — cashier workspace; shifts (open with float, close with counted cash + drawer variance); open-tables worklist with running totals; payment cash/card/QR with discount + change — recomputes bill, marks paid, closes session, frees table, attributes to shift; printable receipt.
- **Reports** — sales analytics over a date range: summary cards (total sales, transactions, avg. ticket), sales by day, payment-method breakdown, by category, top 10 items — derived from recorded payments.
- **Waitstaff** — view all branches via selector; add tables; monitor per-table cards (occupied/available + active orders with status/items/total); mark `ready` orders served; 5s polling refresh.
- **Cross-cutting** — auth/RBAC (`/api/auth/*`, `/forbidden`, account menu); image upload (`POST /api/uploads` → `public/uploads`, ≤5 MB); real-time Socket.IO rooms (per-branch KDS, per-table status).

## Prerequisites

- Node + npm, and a `.env` file (copy `.env.example`). Two connection strings are required:
  - `DATABASE_URL` — pooled connection (port 6543), used by the app at runtime (`src/db/index.ts`).
  - `DIRECT_URL` — direct connection (port 5432), used by migrations and seed.
- Run `npm install` once.

## Run the app

```bash
npm run dev
```

- Serves on `http://localhost:3000` (override with `PORT`).
- This is a **custom server** (`server.ts`, run via `tsx watch`), not `next dev` — it wires up Socket.IO alongside Next. Always start the app this way so real-time KDS / order-status updates work.
- Production: `npm run build` then `npm start`.

## Database

```bash
npm run db:push      # push schema to DB (dev)
npm run db:generate  # generate SQL migrations from schema
npm run db:migrate   # apply migrations
npm run db:seed      # load demo data (idempotent reseed)
npm run db:studio    # Drizzle Studio
```

Schema lives in `src/db/schema/` (one file per domain, re-exported from `src/db/schema/index.ts`). Migrations and seed use `DIRECT_URL`.

## Demo accounts

After `npm run db:seed`, all users share password `password123`:

| Email | Role | Access |
|---|---|---|
| `admin@demo.test` | admin | dashboard, reports, pos, kds, waitstaff |
| `manager@demo.test` | branch_manager | dashboard, reports, kds, waitstaff |
| `cashier@demo.test` | cashier | pos |
| `kitchen@demo.test` | kitchen_staff | kds |
| `waiter@demo.test` | waitstaff | waitstaff |

Log in at `/login`. Area access is enforced by `src/lib/guard.ts` + `src/middleware.ts`.

## Key routes

- **Customer self-order:** `/order/[branchId]/[tableNo]` (menu → cart → status → bill). Public, no auth.
- **KDS:** `/kds/[branchId]` — real-time board, station filter, per-branch screen limit (`maxKdsScreens`, default 3).
- **POS:** `/pos/[branchId]` — shifts, payments, receipts.
- **Dashboard:** `/dashboard` (restaurants index) → `/dashboard/[restaurantId]/...` (branches, categories, menu CRUD, branch-menu overrides, reports).
- **Waitstaff:** `/waitstaff` (resolver) → `/waitstaff/[branchId]`.
- The landing page `/` builds demo entry links from `GET /api/bootstrap`.

## Real-time (Socket.IO)

Server logic is in `server.ts` + `src/lib/socket.ts`; the client helper is `src/lib/socket-client.ts`. Rooms: `branch-kds-{branchId}` (KDS, connection-limited), `branch-{branchId}` (waitstaff, unlimited), `table-{tableId}` (customer status). Events: `kds:join` / `kds:reject` / `kds:screen-count`, `order:new`, `order:status-update`, `order:item-status-update`.

## Conventions

- Money is `numeric(10,2)`; IDs are UUIDs. VAT/service-charge rates live in `Branch.settings` (jsonb).
- API list endpoints support `?page=&limit=` (max 100) and return errors as `{ "error": { "code", "message", "details" } }`.
- Order status transitions are validated: `pending → preparing → ready → served → completed`; cancel only from `pending`/`preparing`.

## Verifying a change

Start `npm run dev`, then exercise the relevant flow in the browser (customer order, KDS board, dashboard). For real-time features, open two tabs (e.g. customer status + KDS) and confirm updates propagate. There is no automated test suite — verify in the running app.
