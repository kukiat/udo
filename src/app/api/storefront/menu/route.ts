import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, serverError } from "@/lib/api";
import type { CategoryWithItemsDTO, MenuItemDTO } from "@/types";

// Customer-facing menu: available items grouped by category, branch overrides
// applied, hidden/sold_out/deleted items filtered out.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, branchId),
      columns: { id: true, restaurantId: true },
    });
    if (!branch) return notFound("Branch not found");

    const [categories, items, overrides] = await Promise.all([
      db.query.categories.findMany({
        where: eq(schema.categories.restaurantId, branch.restaurantId),
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
    ]);

    const overrideByItem = new Map(
      overrides.map((o) => [o.menuItemId, o]),
    );

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

    // Order top-level categories by sortOrder, each immediately followed by its
    // sub-categories. Drop categories that have no available items.
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

    return Response.json({
      branchId,
      categories: result.filter((c) => c.items.length > 0),
    });
  } catch (err) {
    console.error("GET /api/storefront/menu", err);
    return serverError();
  }
}
