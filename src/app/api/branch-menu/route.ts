import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { branchMenuUpdateSchema, normalizeMoney } from "@/lib/validation";

// All master menu items for the branch's restaurant, with any branch override.
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

    const [items, overrides] = await Promise.all([
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
    ]);

    const overrideByItem = new Map(overrides.map((o) => [o.menuItemId, o]));

    const result = items.map((item) => {
      const o = overrideByItem.get(item.id);
      return {
        menuItemId: item.id,
        name: item.name,
        categoryName: item.category?.name ?? null,
        basePrice: item.price,
        masterStatus: item.status,
        isAvailable: o?.isAvailable ?? true,
        overridePrice: o?.price ?? null,
      };
    });

    return Response.json({ branchId, items: result });
  } catch (err) {
    console.error("GET /api/branch-menu", err);
    return serverError();
  }
}

// Bulk upsert branch availability + price overrides.
export async function PUT(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchMenuUpdateSchema);
    if (error) return error;

    await db.transaction(async (tx) => {
      for (const item of data.items) {
        const price = normalizeMoney(item.price);
        const existing = await tx.query.branchMenuItems.findFirst({
          where: and(
            eq(schema.branchMenuItems.branchId, data.branchId),
            eq(schema.branchMenuItems.menuItemId, item.menuItemId),
          ),
          columns: { id: true },
        });
        if (existing) {
          await tx
            .update(schema.branchMenuItems)
            .set({ isAvailable: item.isAvailable, price })
            .where(eq(schema.branchMenuItems.id, existing.id));
        } else {
          await tx.insert(schema.branchMenuItems).values({
            branchId: data.branchId,
            menuItemId: item.menuItemId,
            isAvailable: item.isAvailable,
            price,
          });
        }
      }
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/branch-menu", err);
    return serverError();
  }
}
