import { asc, count, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
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

    const where = restaurantId
      ? eq(schema.branches.restaurantId, restaurantId)
      : undefined;

    // Pagination: offset (default 0) + limit (default 10, max 100). Omit
    // `limit` from the query string to return all branches (unpaginated).
    const hasLimit = searchParams.has("limit");
    const limit = hasLimit
      ? Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 10))
      : undefined;
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const timed = makeTimer(`branches GET ${crypto.randomUUID().slice(0, 8)}`);

    const rows = await timed("select branches", () =>
      db.query.branches.findMany({
        where,
        orderBy: [asc(schema.branches.name)],
        with: withRestaurant
          ? { restaurant: { columns: { id: true, name: true } } }
          : undefined,
        limit,
        offset: hasLimit ? offset : undefined,
      }),
    );

    const [{ value: total } = { value: 0 }] = await timed(
      "count branches",
      () =>
        db.select({ value: count() }).from(schema.branches).where(where),
    );

    return Response.json({ branches: rows, total });
  } catch (err) {
    console.error("GET /api/branches", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, branchCreateSchema);
    if (error) return error;

    const scope = `branches POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const created = await db.transaction(async (tx) => {
      const [branch] = await timed("insert branch", () =>
        tx
          .insert(schema.branches)
          .values({
            restaurantId: data.restaurantId,
            name: data.name,
            address: data.address ?? null,
            openingTime: data.openingTime ?? null,
            closingTime: data.closingTime ?? null,
            settings: data.settings ?? DEFAULT_SETTINGS,
          })
          .returning(),
      );

      const numbers = Array.from(
        new Set((data.tables ?? []).map((n) => n.trim()).filter(Boolean)),
      );
      if (numbers.length > 0) {
        await timed("insert tables", () =>
          tx
            .insert(schema.tables)
            .values(
              numbers.map((tableNumber) => ({
                branchId: branch.id,
                tableNumber,
              })),
            ),
        );
      }

      return branch;
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(
        1,
      )}ms`,
    );
    return Response.json({ branch: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/branches", err);
    return serverError();
  }
}
