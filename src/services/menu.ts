import { and, asc, count, eq, ilike, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer, type Timed } from "@/lib/utils";
import {
  normalizeMoney,
  type MenuItemCreateInput,
  type MenuItemUpdateInput,
} from "@/lib/validation";
import { ServiceError } from "@/services/errors";
import type { CategoryWithItemsDTO, MenuItemDTO } from "@/types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

type MenuItemStatus = "available" | "sold_out" | "hidden";

// --- Dashboard CRUD ---------------------------------------------------------

/** Dashboard list: all statuses (excludes soft-deleted). Paginated. */
export async function listMenuItems(opts: {
  restaurantId: string;
  offset?: number;
  limit?: number;
  q?: string | null;
  categoryId?: string | null;
  status?: string | null;
}) {
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit || DEFAULT_LIMIT));
  const q = opts.q?.trim();
  const validStatus: MenuItemStatus | null =
    opts.status === "available" ||
    opts.status === "sold_out" ||
    opts.status === "hidden"
      ? opts.status
      : null;

  const timed = makeTimer(`menu GET ${crypto.randomUUID().slice(0, 8)}`);

  const where = and(
    eq(schema.menuItems.restaurantId, opts.restaurantId),
    isNull(schema.menuItems.deletedAt),
    q ? ilike(schema.menuItems.name, `%${q}%`) : undefined,
    opts.categoryId ? eq(schema.menuItems.categoryId, opts.categoryId) : undefined,
    validStatus ? eq(schema.menuItems.status, validStatus) : undefined,
  );

  const [items, [{ total }]] = await timed("select menu items + count", () =>
    Promise.all([
      db.query.menuItems.findMany({
        where,
        orderBy: [asc(schema.menuItems.name)],
        limit,
        offset,
        with: {
          category: { columns: { id: true, name: true } },
          kdsStation: { columns: { id: true, name: true } },
        },
      }),
      db.select({ total: count() }).from(schema.menuItems).where(where),
    ]),
  );

  return { items, total, offset, limit };
}

export async function createMenuItem(input: MenuItemCreateInput) {
  const scope = `menu POST ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);
  const txStart = performance.now();
  const created = await db.transaction(async (tx) => {
    const [item] = await timed("insert menu item", () =>
      tx
        .insert(schema.menuItems)
        .values({
          restaurantId: input.restaurantId,
          name: input.name,
          description: input.description ?? null,
          price: input.price,
          image: input.image ?? null,
          categoryId: input.categoryId,
          kdsStationId: input.kdsStationId ?? null,
          status: input.status,
        })
        .returning(),
    );

    for (const group of input.optionGroups ?? []) {
      const [g] = await timed("insert option group", () =>
        tx
          .insert(schema.optionGroups)
          .values({
            menuItemId: item.id,
            name: group.name,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
          })
          .returning(),
      );
      const items = group.optionItems ?? [];
      if (items.length > 0) {
        await timed("insert option items", () =>
          tx.insert(schema.optionItems).values(
            items.map((oi) => ({
              optionGroupId: g.id,
              name: oi.name,
              price: oi.price,
              sortOrder: oi.sortOrder,
            })),
          ),
        );
      }
    }
    return item;
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );
  return created;
}

export async function getMenuItem(id: string) {
  const timed = makeTimer(
    `menu-item GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );
  const item = await timed("select menu item", () =>
    db.query.menuItems.findFirst({
      where: eq(schema.menuItems.id, id),
      with: {
        optionGroups: {
          orderBy: [asc(schema.optionGroups.sortOrder)],
          with: { optionItems: { orderBy: [asc(schema.optionItems.sortOrder)] } },
        },
      },
    }),
  );
  if (!item || item.deletedAt) {
    throw new ServiceError("NOT_FOUND", "Menu item not found", 404);
  }
  return item;
}

/** Replace strategy: option groups/items are wiped and re-inserted. */
export async function updateMenuItem(id: string, input: MenuItemUpdateInput) {
  const scope = `menu-item PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);
  const txStart = performance.now();
  const updated = await db.transaction(async (tx) => {
    const [item] = await timed("update menu item", () =>
      tx
        .update(schema.menuItems)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.price !== undefined && { price: input.price }),
          ...(input.image !== undefined && { image: input.image }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.kdsStationId !== undefined && {
            kdsStationId: input.kdsStationId,
          }),
          ...(input.status !== undefined && { status: input.status }),
        })
        .where(eq(schema.menuItems.id, id))
        .returning(),
    );
    if (!item) return null;

    if (input.optionGroups !== undefined) {
      // Cascading delete on option_groups removes their option_items too.
      await timed("delete option groups", () =>
        tx.delete(schema.optionGroups).where(eq(schema.optionGroups.menuItemId, id)),
      );

      for (const group of input.optionGroups) {
        const [g] = await timed("insert option group", () =>
          tx
            .insert(schema.optionGroups)
            .values({
              menuItemId: id,
              name: group.name,
              required: group.required,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: group.sortOrder,
            })
            .returning(),
        );
        const optItems = group.optionItems ?? [];
        if (optItems.length > 0) {
          await timed("insert option items", () =>
            tx.insert(schema.optionItems).values(
              optItems.map((oi) => ({
                optionGroupId: g.id,
                name: oi.name,
                price: oi.price,
                sortOrder: oi.sortOrder,
              })),
            ),
          );
        }
      }
    }
    return item;
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );

  if (!updated) throw new ServiceError("NOT_FOUND", "Menu item not found", 404);
  return updated;
}

/** Soft delete. */
export async function deleteMenuItem(id: string) {
  const timed = makeTimer(
    `menu-item DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );
  const [deleted] = await timed("soft delete menu item", () =>
    db
      .update(schema.menuItems)
      .set({ deletedAt: new Date() })
      .where(eq(schema.menuItems.id, id))
      .returning(),
  );
  if (!deleted) throw new ServiceError("NOT_FOUND", "Menu item not found", 404);
}

// --- Storefront (customer-facing) -------------------------------------------

/**
 * Customer-facing menu: available items grouped by category, branch overrides
 * applied, hidden/sold_out/deleted items filtered out. Top-level categories are
 * ordered by sortOrder, each followed by its sub-categories; empty categories
 * are dropped.
 */
export async function getStorefrontMenu(branchId: string) {
  const timed = makeTimer(`storefront-menu GET ${crypto.randomUUID().slice(0, 8)}`);

  const branch = await timed("select branch", () =>
    db.query.branches.findFirst({
      where: eq(schema.branches.id, branchId),
      columns: { id: true, restaurantId: true },
    }),
  );
  if (!branch) throw new ServiceError("NOT_FOUND", "Branch not found", 404);

  const [categories, items, overrides] = await timed(
    "select categories + items + overrides",
    () =>
      Promise.all([
        db.query.categories.findMany({
          where: and(
            eq(schema.categories.restaurantId, branch.restaurantId),
            eq(schema.categories.isActive, true),
          ),
          orderBy: [asc(schema.categories.sortOrder)],
        }),
        db.query.menuItems.findMany({
          where: and(
            eq(schema.menuItems.restaurantId, branch.restaurantId),
            eq(schema.menuItems.status, "available"),
            isNull(schema.menuItems.deletedAt),
          ),
          with: {
            optionGroups: {
              orderBy: [asc(schema.optionGroups.sortOrder)],
              with: {
                optionItems: { orderBy: [asc(schema.optionItems.sortOrder)] },
              },
            },
          },
        }),
        db.query.branchMenuItems.findMany({
          where: eq(schema.branchMenuItems.branchId, branchId),
        }),
      ]),
  );

  const overrideByItem = new Map(overrides.map((o) => [o.menuItemId, o]));

  const dtos: MenuItemDTO[] = items
    .filter((item) => {
      const o = overrideByItem.get(item.id);
      return !o || o.isAvailable; // hide items disabled for this branch
    })
    .map((item) => {
      const o = overrideByItem.get(item.id);
      const effectivePrice = o?.price ?? item.price;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: effectivePrice,
        basePrice: item.price,
        image: item.image,
        categoryId: item.categoryId,
        kdsStationId: item.kdsStationId,
        status: item.status,
        optionGroups: item.optionGroups.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: g.sortOrder,
          optionItems: g.optionItems.map((oi) => ({
            id: oi.id,
            name: oi.name,
            price: oi.price,
            sortOrder: oi.sortOrder,
          })),
        })),
      };
    });

  const itemsByCategory = new Map<string, MenuItemDTO[]>();
  for (const dto of dtos) {
    const arr = itemsByCategory.get(dto.categoryId) ?? [];
    arr.push(dto);
    itemsByCategory.set(dto.categoryId, arr);
  }

  const toDTO = (c: (typeof categories)[number]): CategoryWithItemsDTO => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    image: c.image,
    items: itemsByCategory.get(c.id) ?? [],
  });

  const bySort = (a: { sortOrder: number }, b: { sortOrder: number }) =>
    a.sortOrder - b.sortOrder;
  const topLevel = categories.filter((c) => !c.parentId).sort(bySort);
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId).sort(bySort);

  const result: CategoryWithItemsDTO[] = [];
  for (const parent of topLevel) {
    result.push(toDTO(parent));
    for (const child of childrenOf(parent.id)) result.push(toDTO(child));
  }

  return {
    branchId,
    categories: result.filter((c) => c.items.length > 0),
  };
}

// --- Branch menu overrides --------------------------------------------------

/** All master menu items for the branch's restaurant, with any branch override. */
export async function getBranchMenu(branchId: string) {
  const timed = makeTimer(`branch-menu GET ${crypto.randomUUID().slice(0, 8)}`);

  const branch = await timed("select branch", () =>
    db.query.branches.findFirst({
      where: eq(schema.branches.id, branchId),
      columns: { id: true, restaurantId: true },
    }),
  );
  if (!branch) throw new ServiceError("NOT_FOUND", "Branch not found", 404);

  const [items, overrides] = await timed("select items + overrides", () =>
    Promise.all([
      db.query.menuItems.findMany({
        where: and(
          eq(schema.menuItems.restaurantId, branch.restaurantId),
          isNull(schema.menuItems.deletedAt),
        ),
        orderBy: [asc(schema.menuItems.name)],
        with: { category: { columns: { id: true, name: true } } },
      }),
      db.query.branchMenuItems.findMany({
        where: eq(schema.branchMenuItems.branchId, branchId),
      }),
    ]),
  );

  const overrideByItem = new Map(overrides.map((o) => [o.menuItemId, o]));

  const result = items.map((item) => {
    const o = overrideByItem.get(item.id);
    return {
      menuItemId: item.id,
      name: item.name,
      image: item.image ?? null,
      categoryName: item.category?.name ?? null,
      basePrice: item.price,
      masterStatus: item.status,
      isAvailable: o?.isAvailable ?? true,
      overridePrice: o?.price ?? null,
    };
  });

  return { branchId, items: result };
}

type BranchMenuOverrideInput = {
  branchId: string;
  items: { menuItemId: string; isAvailable?: boolean; price?: string | null }[];
};

/** Upsert only the branch menu overrides included in the request. */
export async function upsertBranchMenuOverrides(input: BranchMenuOverrideInput) {
  const timed = makeTimer(`branch-menu upsert ${crypto.randomUUID().slice(0, 8)}`);
  await upsertOverrides(input, timed);
  return { ok: true as const, updated: input.items.length };
}

async function upsertOverrides(data: BranchMenuOverrideInput, timed: Timed) {
  if (data.items.length === 0) return;

  const values = data.items.map((item) => ({
    branchId: data.branchId,
    menuItemId: item.menuItemId,
    isAvailable: item.isAvailable ?? true,
    price: normalizeMoney(item.price),
  }));

  // Single batched upsert keyed on the (branchId, menuItemId) unique index.
  await timed("upsert branch menu overrides", () =>
    db
      .insert(schema.branchMenuItems)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.branchMenuItems.branchId,
          schema.branchMenuItems.menuItemId,
        ],
        set: {
          isAvailable: sql`excluded.is_available`,
          price: sql`excluded.price`,
        },
      }),
  );
}
