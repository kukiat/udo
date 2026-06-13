import { asc } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import { ServiceError } from "@/services/errors";

export class BootstrapService {
  /**
   * Resolve the first seeded restaurant + branch + its KDS stations, used to give
   * the demo landing page a context to build entry links from. Throws NOT_FOUND
   * when nothing is seeded yet.
   */
  async get() {
    const timed = makeTimer(`bootstrap GET ${crypto.randomUUID().slice(0, 8)}`);

    const restaurant = await timed("select restaurant", () =>
      db.query.restaurants.findFirst({
        orderBy: [asc(schema.restaurants.createdAt)],
      }),
    );
    if (!restaurant) throw new ServiceError("NOT_FOUND", "No restaurant seeded", 404);

    const branch = await timed("select branch", () =>
      db.query.branches.findFirst({
        where: (b, { eq }) => eq(b.restaurantId, restaurant.id),
      }),
    );
    if (!branch) throw new ServiceError("NOT_FOUND", "No branch seeded", 404);

    const stations = await timed("select kds stations", () =>
      db.query.kdsStations.findMany({
        where: (s, { eq }) => eq(s.branchId, branch.id),
        orderBy: [asc(schema.kdsStations.sortOrder)],
      }),
    );

    return { restaurant, branch, stations };
  }
}

export const bootstrapService = new BootstrapService();
