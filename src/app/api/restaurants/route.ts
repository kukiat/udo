import { asc } from "drizzle-orm";

import { db, schema } from "@/db";
import { parseBody, serverError } from "@/lib/api";
import { restaurantCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const withBranches = searchParams.get("withBranches") === "true";

    const rows = await db.query.restaurants.findMany({
      orderBy: [asc(schema.restaurants.createdAt)],
      with: withBranches
        ? {
            branches: {
              columns: { id: true, name: true, address: true, settings: true },
              orderBy: [asc(schema.branches.name)],
            },
          }
        : undefined,
    });
    return Response.json({ restaurants: rows });
  } catch (err) {
    console.error("GET /api/restaurants", err);
    return serverError();
  }
}

const DEFAULT_SETTINGS = {
  maxKdsScreens: 3,
  vatRate: 0.07,
  serviceChargeRate: 0,
};

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, restaurantCreateSchema);
    if (error) return error;

    const created = await db.transaction(async (tx) => {
      const [restaurant] = await tx
        .insert(schema.restaurants)
        .values({ name: data.name, logo: data.logo ?? null })
        .returning();

      await tx.insert(schema.branches).values(
        data.branches.map((b) => ({
          restaurantId: restaurant.id,
          name: b.name,
          address: b.address ?? null,
          settings: b.settings ?? DEFAULT_SETTINGS,
        })),
      );

      return restaurant;
    });

    return Response.json({ restaurant: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/restaurants", err);
    return serverError();
  }
}
