import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { categoryUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, categoryUpdateSchema);
    if (error) return error;
    if (data.parentId === id) {
      return badRequest("A category cannot be its own parent");
    }

    const timed = makeTimer(
      `category PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const [updated] = await timed("update category", () =>
      db
        .update(schema.categories)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.parentId !== undefined && {
            parentId: data.parentId ?? null,
          }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.image !== undefined && { image: data.image }),
        })
        .where(eq(schema.categories.id, id))
        .returning(),
    );
    if (!updated) return notFound("Category not found");
    return Response.json({ category: updated });
  } catch (err) {
    console.error("PUT /api/categories/[id]", err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const timed = makeTimer(
      `category DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    // Block delete if any non-deleted menu items reference this category.
    const linked = await timed("select linked menu item", () =>
      db.query.menuItems.findFirst({
        where: and(
          eq(schema.menuItems.categoryId, id),
          isNull(schema.menuItems.deletedAt),
        ),
        columns: { id: true },
      }),
    );
    if (linked) {
      return badRequest("Cannot delete a category that still has menu items");
    }

    const [deleted] = await timed("delete category", () =>
      db
        .delete(schema.categories)
        .where(eq(schema.categories.id, id))
        .returning(),
    );
    if (!deleted) return notFound("Category not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/categories/[id]", err);
    return serverError();
  }
}
