import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { restaurantUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const withBranches = searchParams.get("withBranches") === "true";

    const restaurant = await db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, id),
      with: withBranches
        ? {
            branches: {
              columns: {
                id: true,
                name: true,
                address: true,
                isActive: true,
                settings: true,
              },
              orderBy: [asc(schema.branches.name)],
            },
          }
        : undefined,
    });
    if (!restaurant) return notFound("Restaurant not found");
    return Response.json({ restaurant });
  } catch (err) {
    console.error("GET /api/restaurants/[id]", err);
    return serverError();
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, restaurantUpdateSchema);
    if (error) return error;

    const [updated] = await db
      .update(schema.restaurants)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.logo !== undefined && { logo: data.logo ?? null }),
      })
      .where(eq(schema.restaurants.id, id))
      .returning();
    if (!updated) return notFound("Restaurant not found");
    return Response.json({ restaurant: updated });
  } catch (err) {
    console.error("PUT /api/restaurants/[id]", err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Block delete while branches still exist (which would cascade their data).
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.restaurantId, id),
      columns: { id: true },
    });
    if (branch) {
      return badRequest("Cannot delete a restaurant that still has branches");
    }

    const [deleted] = await db
      .delete(schema.restaurants)
      .where(eq(schema.restaurants.id, id))
      .returning();
    if (!deleted) return notFound("Restaurant not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/restaurants/[id]", err);
    return serverError();
  }
}
