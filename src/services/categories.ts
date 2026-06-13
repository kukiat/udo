import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import type { CategoryCreateInput, CategoryUpdateInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export async function listCategories(restaurantId: string) {
  const timed = makeTimer(`categories GET ${crypto.randomUUID().slice(0, 8)}`);
  return timed("select categories", () =>
    db.query.categories.findMany({
      where: eq(schema.categories.restaurantId, restaurantId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
    }),
  );
}

export async function createCategory(input: CategoryCreateInput) {
  const timed = makeTimer(`categories POST ${crypto.randomUUID().slice(0, 8)}`);
  const [created] = await timed("insert category", () =>
    db
      .insert(schema.categories)
      .values({
        restaurantId: input.restaurantId,
        parentId: input.parentId ?? null,
        name: input.name,
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        sortOrder: input.sortOrder,
        image: input.image ?? null,
      })
      .returning(),
  );
  return created;
}

export async function updateCategory(id: string, input: CategoryUpdateInput) {
  if (input.parentId === id) {
    throw new ServiceError(
      "BAD_REQUEST",
      "A category cannot be its own parent",
      400,
    );
  }

  const timed = makeTimer(
    `category PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );
  const [updated] = await timed("update category", () =>
    db
      .update(schema.categories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.parentId !== undefined && { parentId: input.parentId ?? null }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.image !== undefined && { image: input.image }),
      })
      .where(eq(schema.categories.id, id))
      .returning(),
  );
  if (!updated) throw new ServiceError("NOT_FOUND", "Category not found", 404);
  return updated;
}

export async function deleteCategory(id: string) {
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
    throw new ServiceError(
      "BAD_REQUEST",
      "Cannot delete a category that still has menu items",
      400,
    );
  }

  const [deleted] = await timed("delete category", () =>
    db.delete(schema.categories).where(eq(schema.categories.id, id)).returning(),
  );
  if (!deleted) throw new ServiceError("NOT_FOUND", "Category not found", 404);
}
