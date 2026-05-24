import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { parseBody, serverError } from "@/lib/api";
import { branchCreateSchema } from "@/lib/validation";

const DEFAULT_SETTINGS = {
  maxKdsScreens: 3,
  vatRate: 0.07,
  serviceChargeRate: 0,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    const withRestaurant = searchParams.get("withRestaurant") === "true";

    const rows = await db.query.branches.findMany({
      where: restaurantId
        ? eq(schema.branches.restaurantId, restaurantId)
        : undefined,
      orderBy: [asc(schema.branches.name)],
      with: withRestaurant
        ? { restaurant: { columns: { id: true, name: true } } }
        : undefined,
    });
    return Response.json({ branches: rows });
  } catch (err) {
    console.error("GET /api/branches", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchCreateSchema);
    if (error) return error;

    const [created] = await db
      .insert(schema.branches)
      .values({
        restaurantId: data.restaurantId,
        name: data.name,
        address: data.address ?? null,
        settings: data.settings ?? DEFAULT_SETTINGS,
      })
      .returning();
    return Response.json({ branch: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/branches", err);
    return serverError();
  }
}
