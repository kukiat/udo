# Domain: Organization

The tenancy backbone: restaurants and their branches. Almost every other
domain hangs off `branchId` (or `restaurantId`).

## Purpose

Manage restaurants and branches, including per-branch operational settings
that other domains read at runtime (`maxKdsScreens`, `vatRate`,
`serviceChargeRate`).

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `restaurants` | `src/db/schema/restaurant.ts` | name, logo |
| `branches` | `src/db/schema/branch.ts` | name, address, `settings` jsonb (`maxKdsScreens` default 3, `vatRate` default 0.07, `serviceChargeRate` default 0) |

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET/POST /api/restaurants` | list (`?withBranches=true`); create **with ≥1 branch** in one transaction |
| `GET/PUT/DELETE /api/restaurants/[id]` | read (dashboard scope provider) / update / delete (blocked if branches exist) |
| `GET/POST /api/branches` | list by restaurant; create |
| `GET/PUT/DELETE /api/branches/[id]` | read / update settings / delete (blocked if the branch has orders) |
| `GET /api/bootstrap` | demo entry links for the landing page |

## Key modules

- `src/contexts/RestaurantContext.tsx` — dashboard scope: loads restaurant +
  branches, persists branch selection per restaurant
  (`rms.branch.<restaurantId>` in localStorage), exposes branch `settings` and
  KDS stations.
- Dashboard pages under `src/app/dashboard/` (index, `new/`, `[restaurantId]/`).

## Business rules

- A restaurant must always have at least one branch (enforced at create,
  client- and server-side).
- Deletes are guarded bottom-up: a restaurant with branches and a branch with
  orders cannot be deleted.
- `Branch.settings` is the single source for VAT/service-charge rates
  (consumed by Billing's `calcTotals`) and the KDS screen limit (consumed by
  the real-time layer).

## Dependencies

- **Depends on:** Identity & Access (dashboard guard).
- **Depended on by:** every branch-scoped domain — Catalog (branch
  overrides), Floor & Tables, Ordering, Kitchen/KDS, Billing & Payments,
  Reporting.
