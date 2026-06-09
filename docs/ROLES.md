# RMS — Features & Functionality by Role

A role-oriented reference for the Restaurant Management System. Use this as a
prompt scaffold when specifying new features: pick the role(s), see what they
can already do today, where in the app it lives, and which APIs back it.

- **Access control** is defined in `src/lib/auth.ts` (`AREA_ROLES`) and enforced
  by `requireAccess(area)` in server layouts (`src/lib/guard.ts`) plus the cookie
  gate in `src/middleware.ts`.
- **Post-login landing** is decided in `src/app/login/page.tsx` (`landingFor`).
- All passwords in seed data: `password123`.

## Roles at a glance

| Role | Demo login | Area access | Lands on |
|------|------------|-------------|----------|
| **Customer** (no auth) | — | Storefront (public) | `/order/:branchId/:tableNo` |
| **Owner** | — | Everything | `/dashboard` |
| **Admin** | admin@demo.test | Everything | `/dashboard` |
| **Branch Manager** | manager@demo.test | Dashboard, Reports, KDS, Waitstaff | `/dashboard` |
| **Cashier** | cashier@demo.test | POS | `/pos/:branchId` |
| **Kitchen Staff** | kitchen@demo.test | KDS | `/kds/:branchId` |
| **Waitstaff** | waiter@demo.test | Waitstaff | `/waitstaff` |

> Access map (`AREA_ROLES`): dashboard & reports → owner/admin/branch_manager ·
> pos → owner/admin/cashier · kds → owner/admin/branch_manager/kitchen_staff ·
> waitstaff → owner/admin/branch_manager/waitstaff. Owner/admin reach everything.

---

## 1. Customer (public, unauthenticated)

Entry via QR/link; scoped to a single branch + table. No login.

**Features**
- Browse menu by category, view item detail with option groups / add-ons
- Cart with quantity controls and per-item notes (localStorage-scoped per `branchId:tableNo`)
- Place order; cart clears on success
- Order status page with **real-time** updates (joins `table-{tableId}` room)
- Cancel own order while still `pending`
- Check bill: per-session totals (subtotal, VAT, service charge, discount) and "request check"

**Pages** — `src/app/order/[branchId]/[tableNo]/`
- `page.tsx` (menu) · `cart/page.tsx` · `status/page.tsx` · `bill/page.tsx`

**APIs** — `storefront/menu` · `tables` · `sessions` · `orders` (+ `[id]`, `[id]/status`, `[id]/cancel`) · `bills` (+ `request-check`)

---

## 2. Owner / Admin (super-users)

Full access to every area. Admin is the seeded super-user; owner is the same access level.

**Features** — the union of all areas below:
- Everything in **Branch Manager** (menu management + reports + KDS + waitstaff)
- Everything in **Cashier** (POS)
- Everything in **Kitchen Staff** (KDS)
- Manage **restaurants** (create/edit/delete) and **branches** across the org

**Pages** — `/dashboard` (restaurants index), `/dashboard/new`, all `/dashboard/:restaurantId/*`, `/pos/:branchId`, `/kds/:branchId`, `/waitstaff`

---

## 3. Branch Manager

Owns menu, structure, and reporting for the restaurant; can also watch the kitchen and floor.

**Features**
- **Restaurant & branch management**: create/edit/delete restaurants and branches; branch settings (max KDS screens, VAT %, service charge %)
- **Categories**: CRUD with sort order + sub-categories (self-referential parent)
- **Menu items**: dynamic create/edit form (React Hook Form + field arrays) — nested option groups & option items added/removed inline, saved in one request; status toggle (available / sold_out / hidden); soft delete; KDS station assignment; image upload or URL
- **Branch menu override**: per-branch availability toggle + price override (bulk save)
- **Reports**: sales analytics (see role 7's feature list)
- **Overview bill/payment snapshot**: revenue today, paid bills, requested checks, open bills, and average order value for the selected branch
- Can also open **KDS** and **Waitstaff** views (read/monitor)

**Pages** — `src/app/dashboard/[restaurantId]/`
- `page.tsx` (overview) · `branches/` · `categories/` · `menu/` (+ `create/`, `[id]/edit/`) · `branch-menu/` · `reports/`
- Sidebar nav: Overview · Branches · Categories · Menu Items · Branch Menu · Reports (`src/components/dashboard/Sidebar.tsx`)

**APIs** — `restaurants` (+ `[id]`) · `branches` (+ `[id]`) · `categories` (+ `[id]`) · `menu` (+ `[id]`) · `branch-menu` · `reports/sales` · `uploads`

---

## 4. Cashier (POS)

Front-counter checkout and cash handling for a single branch.

**Features**
- **Shift management**: open a shift with a cash float; close with counted cash + drawer variance
- **Open-tables worklist**: active table sessions with running totals and bill status
- **Take payment**: cash / card / QR, optional discount, change calculation — recomputes the bill, marks it paid, closes the session, frees the table, attributes the payment to the open shift
- **Printable receipt**

**Pages** — `src/app/pos/[branchId]/page.tsx`
- Components: `src/components/pos/` (ShiftBar, PaymentModal, Receipt)

**APIs** — `shifts` (+ `[id]/close`) · `pos/sessions` · `payments` · `bills`

---

## 5. Kitchen Staff (KDS)

Real-time kitchen display for a single branch.

**Features**
- Real-time order board, FIFO ordering (oldest first); connects to `branch-kds-{branchId}` room
- **Station filter tabs** (All / Hot Kitchen / Cold Kitchen / Drinks) + status filters
- Advance order status: pending → preparing → ready → served
- **Cancel** an order with optional reason while pending/preparing (drops off the board)
- **Overdue alerts**: cards flash red past threshold (default 15 min)
- **Per-branch connection limit**: server rejects beyond `maxKdsScreens`; live "Screen N of M" count

**Pages** — `src/app/kds/[branchId]/page.tsx`
- Components: `src/components/kds/` (KdsOrderCard, …)

**APIs / events** — `orders` (+ `[id]/status`, `[id]/cancel`) · `kds-stations` · Socket.IO: `kds:join`, `kds:reject`, `kds:screen-count`, `order:new`, `order:status-update`, `order:item-status-update`

---

## 6. Waitstaff (Floor Service)

Floor-service view across branches of the restaurant.

**Features**
- **View all branches** via a branch selector; `/waitstaff` resolves a default branch
- **Add tables** to the selected branch
- **Monitor tables**: per-table cards showing occupied/available status + every active order (pending/preparing/ready/served) with status badges, items, and total
- **Bill awareness**: requested-check badges on the floor map, a Bill alerts queue, rough table totals, and a POS payment handoff
- **Mark served** on `ready` orders; board auto-refreshes (5s polling)

**Pages** — `src/app/waitstaff/page.tsx` (resolver) · `src/app/waitstaff/[branchId]/page.tsx`

**APIs** — `branches` · `tables` (+ `[id]`) · `orders` (with `statuses=` CSV filter) · `orders/[id]/status`

---

## 7. Reports (Branch Manager / Owner / Admin)

Lives inside the dashboard but called out separately since it's a distinct capability.

**Features** — `/dashboard/:restaurantId/reports` (date range)
- Summary cards: total sales, paid bills, avg. ticket, discounts, VAT/service charge, requested checks
- Active bill status snapshot, active bill amount, payment-method breakdown, cashier totals, and shift payment totals
- Sales by day (bar chart), sales by category, top 10 items
- Derived from recorded payments + the order items behind each paid bill

**APIs** — `reports/sales?branchId=X&from=&to=`

---

## Cross-cutting capabilities

- **Auth & RBAC** — login/logout/session (`/api/auth/*`), scrypt-hashed passwords, middleware + server guards, `/forbidden` page. Every authenticated area shows an account menu (name, email, role, sign-out).
- **Image upload** — `POST /api/uploads` → `public/uploads` (≤5 MB; png/jpg/webp/gif). Reusable `ImageUpload` component (upload or paste URL) used by menu items, categories, restaurant logos.
- **Real-time** — Socket.IO room-per-branch (KDS) and room-per-table (customer status).

---

## How to spec a new feature (template)

When prompting for a new feature, fill in:

1. **Role(s)** — who uses it (from the table above) and whether `AREA_ROLES` needs a new entry/role.
2. **Where** — which page/route it lives on (new route under the role's area, or an addition to an existing page).
3. **Data** — new/changed Drizzle models in `src/db/schema/` (remember: uuid ids, `numeric(10,2)` money, `pgEnum`, soft-delete via `deletedAt`).
4. **API** — new route(s) under `src/app/api/...`, Zod-validated (`src/lib/validation.ts`), standardized error shape, `?page/limit` for lists.
5. **Real-time** — any new Socket.IO events and which room they broadcast to.
6. **Guard** — `requireAccess(area)` in the server layout + middleware path if protected.
