import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { notFound, parseBody, serverError } from "@/lib/api";
import { menuItemUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await db.query.menuItems.findFirst({
      where: eq(schema.menuItems.id, id),
      with: {
        optionGroups: {
          orderBy: [asc(schema.optionGroups.sortOrder)],
          with: {
            optionItems: { orderBy: [asc(schema.optionItems.sortOrder)] },
          },
        },
      },
    });
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

    const updated = await db.transaction(async (tx) => {
      const [item] = await tx
        .update(schema.menuItems)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.image !== undefined && { image: data.image }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.kdsStationId !== undefined && {
            kdsStationId: data.kdsStationId,
          }),
          ...(data.status !== undefined && { status: data.status }),
        })
        .where(eq(schema.menuItems.id, id))
        .returning();
      if (!item) return null;

      if (data.optionGroups !== undefined) {
        // Cascading delete on option_groups removes their option_items too.
        await tx
          .delete(schema.optionGroups)
          .where(eq(schema.optionGroups.menuItemId, id));

        for (const group of data.optionGroups) {
          const [g] = await tx
            .insert(schema.optionGroups)
            .values({
              menuItemId: id,
              name: group.name,
              required: group.required,
              minSelect: group.minSelect,
              maxSelect: group.maxSelect,
              sortOrder: group.sortOrder,
            })
            .returning();
          const optItems = group.optionItems ?? [];
          if (optItems.length > 0) {
            await tx.insert(schema.optionItems).values(
              optItems.map((oi) => ({
                optionGroupId: g.id,
                name: oi.name,
                price: oi.price,
                sortOrder: oi.sortOrder,
              })),
            );
          }
        }
      }
      return item;
    });

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
    const [deleted] = await db
      .update(schema.menuItems)
      .set({ deletedAt: new Date() })
      .where(eq(schema.menuItems.id, id))
      .returning();
    if (!deleted) return notFound("Menu item not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/menu/[id]", err);
    return serverError();
  }
}
