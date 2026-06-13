# Domain: Catalog

What the restaurant sells: categories, menu items, option groups, and
per-branch availability/price overrides — plus the customer-facing storefront
view of all of it.

## Purpose

Owns the master menu per restaurant and its branch-level overrides. Exposes
two very different read models: a management view (all statuses, for the
dashboard) and a storefront view (available items only, branch prices
applied, grouped by category).

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `categories` | `src/db/schema/category.ts` | `parentId` self-FK for sub-categories, `sortOrder`, image |
| `menu_items` | `src/db/schema/menu.ts` | price, image, `categoryId`, `kdsStationId` (FK into Kitchen/KDS), status (`available`/`sold_out`/`hidden`), soft delete via `deletedAt` |
| `option_groups` | `src/db/schema/menu.ts` | per item: required, min/max select, `sortOrder` |
| `option_items` | `src/db/schema/menu.ts` | per group: name, price delta, `sortOrder` |
| `branch_menu_items` | `src/db/schema/menu.ts` | per branch × item: `isAvailable`, nullable price override |

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET/POST /api/categories` · `PUT/DELETE /api/categories/[id]` | CRUD; `parentId` supported, self-parent rejected; delete blocked while menu items exist |
| `GET/POST /api/menu` · `GET/PUT/DELETE /api/menu/[id]` | management CRUD; create/update take the **nested** item + option groups + options in one request (upsert/replace strategy); delete is soft (`deletedAt`) |
| `GET/PUT /api/branch-menu` | read items with branch overrides; bulk save availability + price overrides |
| `GET /api/storefront/menu?branchId=X` | **public** customer read model: filters hidden/sold-out/deleted/branch-unavailable, applies branch price overrides, groups by category |
| `POST /api/uploads` | image upload to `public/uploads` (≤5 MB, png/jpg/webp/gif) |

## Key modules

- `src/lib/menu-form.ts` — form ↔ API mapping for the dynamic menu item form
- `src/lib/validation.ts` — nested Zod schemas (item → groups → options)
- `src/components/dashboard/MenuItemForm.tsx` — React Hook Form +
  `useFieldArray` dynamic form
- `src/components/menu/` — storefront UI (CategoryTabs, MenuCard,
  MenuItemDetail)

## Business rules

- Effective price at a branch = `branch_menu_items.price` override if set,
  else master `menu_items.price`. Effective availability = master status
  `available` **and** branch `isAvailable`.
- Menu items are never hard-deleted (order history references them);
  `deletedAt` hides them everywhere.
- A category with menu items cannot be deleted; a category cannot be its own
  parent.

## Dependencies

- **Depends on:** Organization (restaurant/branch scope), Kitchen/KDS
  (`kdsStationId` routing tag), Identity & Access (dashboard guard; storefront
  endpoint is public).
- **Depended on by:** Ordering (order items snapshot `unitPrice`/option prices
  from the catalog at placement time), Reporting (category/top-item
  breakdowns).
