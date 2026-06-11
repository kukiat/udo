# RMS — Restaurant Management System

A full-stack restaurant management system covering **customer self-ordering**, a **real-time kitchen display (KDS)**, **point of sale (POS)**, **menu management**, **sales reports** (including a Claude-powered "Ask agent" chat), and **waitstaff floor service** — built on Next.js 15 (App Router) with PostgreSQL, Drizzle ORM, and Socket.IO.

## Features

### Customer Self-Order
- QR/link entry per table: `/order/:branchId/:tableNo`
- Menu browsing by category, item detail modal with option groups and add-ons
- Cart persisted to `localStorage` (scoped per branch + table), order placement
- Live order status page (Socket.IO) with cancel while `pending`
- Bill page with per-session totals (subtotal, VAT, service charge, discount) and "request check"

### Kitchen Display (KDS)
- Real-time order board per branch at `/kds/:branchId`, FIFO ordering
- Station filter tabs (Hot Kitchen / Cold Kitchen / Drinks), overdue alerts
- Status flow: `pending → preparing → ready → served → completed`; cancel with reason
- Per-branch screen limit (`maxKdsScreens`) with rejection screen and live screen count

### Menu Management (Dashboard)
- Restaurants and branches CRUD with branch settings (max KDS screens, VAT %, service charge %)
- Categories with sort order and nested **sub-categories**
- Menu item editor with dynamic option groups/items (React Hook Form + field arrays), saved in one request
- Status toggle (available / sold_out / hidden), soft delete
- Per-branch overrides: availability toggle and price override

### Point of Sale
- Cashier workspace at `/pos/:branchId`
- Shift management: open with cash float, close with counted cash and drawer variance
- Open-tables worklist with running totals and bill status
- Payments (cash / card / QR) with optional discount and change calculation; printable receipt

### Reports
- Sales analytics at `/dashboard/:restaurantId/reports` with date range
- Summary cards, sales by day, sales by category, top items, payment-method and cashier breakdowns
- "Ask agent" report chat backed by the Anthropic API

### Waitstaff
- Floor-service workspace at `/waitstaff/:branchId` with branch selector
- Per-table cards showing occupancy, active orders, and requested checks
- Add tables, mark `ready` orders as served

### Auth & RBAC
- Cookie sessions (`rms_session`, httpOnly) backed by a sessions table, scrypt password hashing
- Middleware + server-side `requireAccess` guards

| Area | Roles with access |
|------|-------------------|
| Dashboard & Reports | owner, admin, branch_manager |
| POS | owner, admin, cashier |
| KDS | owner, admin, branch_manager, kitchen_staff |
| Waitstaff | owner, admin, branch_manager, waitstaff |

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript, custom Node server ([server.ts](server.ts)) for Socket.IO
- **Database:** PostgreSQL + Drizzle ORM (`drizzle-kit` migrations)
- **Real-time:** Socket.IO — room per branch (KDS) and room per table (customer status)
- **UI:** Tailwind CSS + React Aria Components, custom "Claude visual style" theme
- **Forms & validation:** React Hook Form + Zod
- **AI:** `@anthropic-ai/sdk` for the reports agent

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database — either local via Docker or Supabase

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | App runtime connection (Supabase: transaction pooler, port 6543) |
| `DIRECT_URL` | Migrations & seed (direct connection, port 5432) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Image uploads via Supabase Storage |
| `ANTHROPIC_API_KEY` | Reports "Ask agent" chat (`POST /api/reports/agent`) |

For a local database instead of Supabase, start Postgres with Docker:

```bash
docker compose up -d
```

then point both URLs at it:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rms"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/rms"
```

### 3. Set up the database

```bash
npm run db:migrate   # apply migrations (or: npm run db:push)
npm run db:seed      # demo restaurant, menu, tables, users
```

### 4. Run the app

```bash
npm run dev
```

The custom server (Next.js + Socket.IO) starts at [http://localhost:3000](http://localhost:3000). The landing page links to demo entry points for each module.

## Demo Accounts

All seeded with password `password123`:

| Email | Role | Lands on |
|-------|------|----------|
| `admin@demo.test` | admin | Dashboard |
| `manager@demo.test` | branch_manager | Dashboard |
| `cashier@demo.test` | cashier | POS |
| `kitchen@demo.test` | kitchen_staff | KDS |
| `waiter@demo.test` | waitstaff | Waitstaff |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (tsx watch, Turbopack) with Socket.IO |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate SQL migrations from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (no migration files) |
| `npm run db:studio` | Drizzle Studio (DB browser) |
| `npm run db:seed` | Seed demo data |

## Real-Time Events

| Event | Description |
|-------|-------------|
| `kds:join` / `kds:reject` | Join a branch KDS room; rejected when the screen limit is reached |
| `kds:screen-count` | Live connected-screen count per branch |
| `order:new` | New order broadcast to the branch KDS room |
| `order:status-update` | Status changes broadcast to KDS and the customer's table room |
| `bill:requested` / `bill:paid` | Bill workflow updates to the customer table and floor staff |

## Project Structure

```
rms/
├── server.ts                 # Custom Next.js server + Socket.IO
├── docker-compose.yml        # Local Postgres
├── drizzle/                  # Generated SQL migrations
├── docs/                     # FEATURES, ROLES, DATABASE_DDL, db-diagram
└── src/
    ├── middleware.ts         # Auth cookie gate for protected paths
    ├── app/
    │   ├── order/[branchId]/[tableNo]/   # Customer: menu, cart, status, bill
    │   ├── dashboard/                     # Menu management, branches, reports
    │   ├── kds/[branchId]/                # Kitchen display
    │   ├── pos/[branchId]/                # Cashier workspace
    │   ├── waitstaff/                     # Floor service
    │   └── api/                           # REST endpoints
    ├── components/           # menu/, dashboard/, pos/, kds/, ui/
    ├── contexts/             # Cart, Auth, Restaurant
    ├── db/                   # schema/ (per-domain), seed.ts, client singleton
    └── lib/                  # auth, guards, sockets, validation, utils
```

## Documentation

- [docs/FEATURES.md](docs/FEATURES.md) — full feature summary
- [docs/ROLES.md](docs/ROLES.md) — roles and access control
- [docs/DATABASE_DDL.md](docs/DATABASE_DDL.md) — database DDL reference
- [docs/db-diagram.md](docs/db-diagram.md) — schema diagram
- [CLAUDE.md](CLAUDE.md) — detailed build spec (schema, API endpoints, page specs)
