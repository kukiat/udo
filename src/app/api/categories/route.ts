import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { categoryCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const timed = makeTimer(`categories GET ${crypto.randomUUID().slice(0, 8)}`);
    const rows = await timed("select categories", () =>
      db.query.categories.findMany({
        where: eq(schema.categories.restaurantId, restaurantId),
        orderBy: [
          asc(schema.categories.sortOrder),
          asc(schema.categories.name),
        ],
      }),
    );
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

    const timed = makeTimer(
      `categories POST ${crypto.randomUUID().slice(0, 8)}`,
    );
    const [created] = await timed("insert category", () =>
      db
        .insert(schema.categories)
        .values({
          restaurantId: data.restaurantId,
          parentId: data.parentId ?? null,
          name: data.name,
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          sortOrder: data.sortOrder,
          image: data.image ?? null,
        })
        .returning(),
    );
    return Response.json({ category: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/categories", err);
    return serverError();
  }
}
