import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { notFound, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { menuItemUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const timed = makeTimer(
      `menu-item GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const item = await timed("select menu item", () =>
      db.query.menuItems.findFirst({
        where: eq(schema.menuItems.id, id),
        with: {
          optionGroups: {
            orderBy: [asc(schema.optionGroups.sortOrder)],
            with: {
              optionItems: { orderBy: [asc(schema.optionItems.sortOrder)] },
            },
          },
        },
      }),
    );
    if (!item || item.deletedAt) return notFound("Menu item not found");
    return Response.json({ item });
  } catch (err) {
    console.error("GET /api/menu/[id]", err);
    return serverError();
  }
}

// Replace strategy: option groups/items are wiped and re-inserted.
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, menuItemUpdateSchema);
    if (error) return error;

    const scope = `menu-item PUT ${id.slice(0, 8)} ${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const updated = await db.transaction(async (tx) => {
      const [item] = await timed("update menu item", () =>
        tx
          .update(schema.menuItems)
          .set({
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && {
              description: data.description,
            }),
            ...(data.price !== undefined && { price: data.price }),
            ...(data.image !== undefined && { image: data.image }),
            ...(data.categoryId !== undefined && {
              categoryId: data.categoryId,
            }),
            ...(data.kdsStationId !== undefined && {
              kdsStationId: data.kdsStationId,
            }),
            ...(data.status !== undefined && { status: data.status }),
          })
          .where(eq(schema.menuItems.id, id))
          .returning(),
      );
      if (!item) return null;

      if (data.optionGroups !== undefined) {
        // Cascading delete on option_groups removes their option_items too.
        await timed("delete option groups", () =>
          tx
            .delete(schema.optionGroups)
            .where(eq(schema.optionGroups.menuItemId, id)),
        );

        for (const group of data.optionGroups) {
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
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(
        1,
      )}ms`,
    );

    if (!updated) return notFound("Menu item not found");
    return Response.json({ item: updated });
  } catch (err) {
    console.error("PUT /api/menu/[id]", err);
    return serverError();
  }
}

// Soft delete.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
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
    if (!deleted) return notFound("Menu item not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/menu/[id]", err);
    return serverError();
  }
}
