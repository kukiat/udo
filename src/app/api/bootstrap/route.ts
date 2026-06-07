import { asc } from "drizzle-orm";

import { db, schema } from "@/db";
import { notFound, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";

// Phase 1 has no auth: resolve the current restaurant/branch as the first
// seeded ones so the dashboard and KDS have a context to operate in.
export async function GET() {
  try {
    const timed = makeTimer(`bootstrap GET ${crypto.randomUUID().slice(0, 8)}`);

    const restaurant = await timed("select restaurant", () =>
      db.query.restaurants.findFirst({
        orderBy: [asc(schema.restaurants.createdAt)],
      }),
    );
    if (!restaurant) return notFound("No restaurant seeded");

    const branch = await timed("select branch", () =>
      db.query.branches.findFirst({
        where: (b, { eq }) => eq(b.restaurantId, restaurant.id),
      }),
    );
    if (!branch) return notFound("No branch seeded");

    const stations = await timed("select kds stations", () =>
      db.query.kdsStations.findMany({
        where: (s, { eq }) => eq(s.branchId, branch.id),
        orderBy: [asc(schema.kdsStations.sortOrder)],
      }),
    );

    return Response.json({ restaurant, branch, stations });
  } catch (err) {
    console.error("GET /api/bootstrap", err);
    return serverError();
  }
}
