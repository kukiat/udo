# RMS — Feature Summary

Restaurant Management System: customer self-ordering, a real-time kitchen
display, point-of-sale, menu management, reporting, and floor service — built
on Next.js (App Router) full-stack with PostgreSQL + Drizzle ORM, Socket.IO,
and a custom "Claude visual style" Tailwind theme.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript, custom Node server (`server.ts`)
- **Database:** PostgreSQL + Drizzle ORM (`drizzle-kit` migrations)
- **Real-time:** Socket.IO (room-per-branch / room-per-table)
- **Validation:** Zod (`src/lib/validation.ts`)
- **UI:** React Aria Components + Tailwind; React Hook Form for dynamic forms
- **Auth:** Cookie sessions, scrypt password hashing

## Roles & Access Control

Authentication uses opaque session cookies backed by a `sessions` table; routes
are gated by middleware (cookie presence) plus server-side role checks
(`requireAccess`). Access map (`src/lib/auth.ts`):

| Area | Roles with access |
|------|-------------------|
| Dashboard (menu mgmt) | owner, admin, branch_manager |
| Reports | owner, admin, branch_manager |
| POS | owner, admin, cashier |
| KDS | owner, admin, branch_manager, kitchen_staff |
| Waitstaff | owner, admin, branch_manager, waitstaff |

Each role lands on a sensible page after login; an account menu (name, email,
role, sign-out) is shown in every authenticated area.

---

## Modules

### 1. Customer Self-Order
- QR/link entry to `/order/:branchId/:tableNo`
- Browse menu by category, item detail modal with option groups/add-ons
- Cart (localStorage-scoped per `branchId:tableNo`), place order
- Order status page with **real-time** updates; cancel while `pending`
- Bill page: per-session totals (subtotal, VAT, service charge, discount) and "request check"

### 2. Kitchen Display (KDS)
- Real-time order board per branch (`/kds/:branchId`), FIFO ordering
- Station filter tabs (All / Hot / Cold / Drinks) and status filters
- Advance status pending → preparing → ready → served; cancel with reason
- Overdue alerts; **per-branch connection limit** with rejection screen when `maxKdsScreens` reached

### 3. Menu Management (Dashboard)
- Restaurants & branches CRUD (branch settings: max KDS, VAT %, service %)
- **Categories** with sort order and **sub-categories** (self-referential parent)
- **Menu items** via dynamic form (React Hook Form + field arrays): nested option groups & option items added/removed inline, saved in one request
- Status toggle (available / sold_out / hidden), soft delete
- **Branch menu override**: per-branch availability + price override

### 4. Point of Sale (POS) — *Phase 2*
- Cashier workspace at `/pos/:branchId`
- **Shift management**: open with cash float, close with counted cash + drawer variance
- **Open-tables worklist** with running totals and bill status
- **Payment**: cash / card / QR, optional discount, change calculation; recomputes the bill, marks it paid, closes the session, frees the table, attributes the payment to the open shift
- **Printable receipt**

### 5. Reports — *Phase 2*
- Sales analytics at `/dashboard/:restaurantId/reports` (date range)
- Summary cards (total sales, transactions, avg. ticket)
- Sales by day (bar chart), payment-method breakdown, sales by category, top 10 items
- Derived from recorded payments + the order items behind each paid bill

### 6. Waitstaff (Floor Service) — *Phase 2*
- Workspace at `/waitstaff` (resolves a branch) / `/waitstaff/:branchId`
- **View all branches** of the restaurant via a branch selector
- **Add tables** to the selected branch
- **Monitor tables**: per-table cards showing occupied/available status and every active order (pending/preparing/ready/served) with status badges, items, and total
- **Mark served** on `ready` orders; board auto-refreshes (5s polling)

### 7. Authentication & RBAC — *Phase 2*
- Login / logout / session (`/api/auth/*`), scrypt-hashed passwords
- Middleware + server-side guards; `/forbidden` page for unauthorized roles

### 8. Image Upload — *Phase 2*
- `POST /api/uploads` stores images under `public/uploads` (5 MB, png/jpg/webp/gif)
- Reusable `ImageUpload` component (upload **or** paste URL) wired into menu items, categories, and restaurant logos

---

## Real-Time Events (Socket.IO)

- `kds:join` / `kds:reject` — join branch KDS room, enforce screen limit
- `kds:screen-count` — live connected-screen count
- `order:new` — new order broadcast to the branch KDS room
- `order:status-update` — broadcast to branch KDS + the customer's table room

## API Surface (high level)

`auth` (login/logout/me) · `restaurants` · `branches` · `categories` ·
`menu` (+ `[id]`) · `branch-menu` · `storefront/menu` · `tables` (+ `[id]`) ·
`sessions` · `orders` (+ `[id]`, `status`, `cancel`) · `bills` (+ `request-check`) ·
`kds-stations` · `shifts` (+ `[id]/close`) · `payments` · `pos/sessions` ·
`reports/sales` · `uploads`

## Demo Accounts (after `npm run db:seed`)

All passwords: `password123`

| Email | Role |
|-------|------|
| admin@demo.test | admin |
| manager@demo.test | branch_manager |
| cashier@demo.test | cashier |
| kitchen@demo.test | kitchen_staff |
| waiter@demo.test | waitstaff |

## Local Setup

```bash
npm install
npm run db:migrate   # or db:push
npm run db:seed
npm run dev          # custom server with Socket.IO
```
