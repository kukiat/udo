import { and, asc, count, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { menuItemCreateSchema } from "@/lib/validation";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Dashboard list: all statuses (excludes soft-deleted). Paginated via offset/limit.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const rawLimit = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

    const where = and(
      eq(schema.menuItems.restaurantId, restaurantId),
      isNull(schema.menuItems.deletedAt),
    );

    const [items, [{ total }]] = await Promise.all([
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
    ]);

    return Response.json({ items, total, offset, limit });
  } catch (err) {
    console.error("GET /api/menu", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, menuItemCreateSchema);
    if (error) return error;

    const created = await db.transaction(async (tx) => {
      const [item] = await tx
        .insert(schema.menuItems)
        .values({
          restaurantId: data.restaurantId,
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          image: data.image ?? null,
          categoryId: data.categoryId,
          kdsStationId: data.kdsStationId ?? null,
          status: data.status,
        })
        .returning();

      for (const group of data.optionGroups ?? []) {
        const [g] = await tx
          .insert(schema.optionGroups)
          .values({
            menuItemId: item.id,
            name: group.name,
            required: group.required,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: group.sortOrder,
          })
          .returning();
        const items = group.optionItems ?? [];
        if (items.length > 0) {
          await tx.insert(schema.optionItems).values(
            items.map((oi) => ({
              optionGroupId: g.id,
              name: oi.name,
              price: oi.price,
              sortOrder: oi.sortOrder,
            })),
          );
        }
      }
      return item;
    });

    return Response.json({ item: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/menu", err);
    return serverError();
  }
}
