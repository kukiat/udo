import { and, asc, count, eq, ilike, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
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

    const q = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status");
    const validStatus =
      status === "available" || status === "sold_out" || status === "hidden"
        ? status
        : null;

    const timed = makeTimer(`menu GET ${crypto.randomUUID().slice(0, 8)}`);

    const where = and(
      eq(schema.menuItems.restaurantId, restaurantId),
      isNull(schema.menuItems.deletedAt),
      q ? ilike(schema.menuItems.name, `%${q}%`) : undefined,
      categoryId ? eq(schema.menuItems.categoryId, categoryId) : undefined,
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

    const scope = `menu POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const created = await db.transaction(async (tx) => {
      const [item] = await timed("insert menu item", () =>
        tx
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
          .returning(),
      );

      for (const group of data.optionGroups ?? []) {
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
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(
        1,
      )}ms`,
    );

    return Response.json({ item: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/menu", err);
    return serverError();
  }
}
