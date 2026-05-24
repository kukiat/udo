import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { categoryCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const rows = await db.query.categories.findMany({
      where: eq(schema.categories.restaurantId, restaurantId),
      orderBy: [asc(schema.categories.sortOrder), asc(schema.categories.name)],
    });
    return Response.json({ categories: rows });
  } catch (err) {
    console.error("GET /api/categories", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, categoryCreateSchema);
    if (error) return error;

    const [created] = await db
      .insert(schema.categories)
      .values({
        restaurantId: data.restaurantId,
        parentId: data.parentId ?? null,
        name: data.name,
        sortOrder: data.sortOrder,
        image: data.image ?? null,
      })
      .returning();
    return Response.json({ category: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/categories", err);
    return serverError();
  }
}
