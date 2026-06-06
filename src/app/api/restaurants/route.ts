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
              columns: {
                id: true,
                name: true,
                address: true,
                openingTime: true,
                closingTime: true,
                settings: true,
              },
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

      const insertedBranches = await tx
        .insert(schema.branches)
        .values(
          data.branches.map((b) => ({
            restaurantId: restaurant.id,
            name: b.name,
            address: b.address ?? null,
            openingTime: b.openingTime ?? null,
            closingTime: b.closingTime ?? null,
            settings: b.settings ?? DEFAULT_SETTINGS,
          })),
        )
        .returning({ id: schema.branches.id });

      const tableRows = data.branches.flatMap((b, idx) => {
        const branchId = insertedBranches[idx].id;
        const numbers = Array.from(
          new Set((b.tables ?? []).map((n) => n.trim()).filter(Boolean)),
        );
        return numbers.map((tableNumber) => ({ branchId, tableNumber }));
      });
      if (tableRows.length > 0) {
        await tx.insert(schema.tables).values(tableRows);
      }

      return restaurant;
    });

    return Response.json({ restaurant: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/restaurants", err);
    return serverError();
  }
}
