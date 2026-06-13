import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import type {
  RestaurantCreateInput,
  RestaurantUpdateInput,
} from "@/lib/validation";
import { DEFAULT_BRANCH_SETTINGS, normalizeTableNumbers } from "@/services/branches";
import { ServiceError } from "@/services/errors";

export class RestaurantService {
  async list(opts: { withBranches: boolean }) {
    const timed = makeTimer(`restaurants GET ${crypto.randomUUID().slice(0, 8)}`);
    return timed("select restaurants", () =>
      db.query.restaurants.findMany({
        orderBy: [asc(schema.restaurants.createdAt)],
        with: opts.withBranches
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
      }),
    );
  }

  async create(input: RestaurantCreateInput) {
    const scope = `restaurants POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const created = await db.transaction(async (tx) => {
      const [restaurant] = await timed("insert restaurant", () =>
        tx
          .insert(schema.restaurants)
          .values({ name: input.name, logo: input.logo ?? null })
          .returning(),
      );

      const insertedBranches = await timed("insert branches", () =>
        tx
          .insert(schema.branches)
          .values(
            input.branches.map((b) => ({
              restaurantId: restaurant.id,
              name: b.name,
              address: b.address ?? null,
              openingTime: b.openingTime ?? null,
              closingTime: b.closingTime ?? null,
              settings: b.settings ?? DEFAULT_BRANCH_SETTINGS,
            })),
          )
          .returning({ id: schema.branches.id }),
      );

      const tableRows = input.branches.flatMap((b, idx) => {
        const branchId = insertedBranches[idx].id;
        return normalizeTableNumbers(b.tables).map((tableNumber) => ({
          branchId,
          tableNumber,
        }));
      });
      if (tableRows.length > 0) {
        await timed("insert tables", () =>
          tx.insert(schema.tables).values(tableRows),
        );
      }

      return restaurant;
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
    );
    return created;
  }

  async get(id: string, opts: { withBranches: boolean }) {
    const timed = makeTimer(
      `restaurant GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const restaurant = await timed("select restaurant", () =>
      db.query.restaurants.findFirst({
        where: eq(schema.restaurants.id, id),
        with: opts.withBranches
          ? {
              branches: {
                columns: {
                  id: true,
                  name: true,
                  address: true,
                  openingTime: true,
                  closingTime: true,
                  isActive: true,
                  settings: true,
                },
                orderBy: [asc(schema.branches.name)],
              },
            }
          : undefined,
      }),
    );
    if (!restaurant) {
      throw new ServiceError("NOT_FOUND", "Restaurant not found", 404);
    }
    return restaurant;
  }

  async update(id: string, input: RestaurantUpdateInput) {
    const timed = makeTimer(
      `restaurant PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const [updated] = await timed("update restaurant", () =>
      db
        .update(schema.restaurants)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.logo !== undefined && { logo: input.logo ?? null }),
        })
        .where(eq(schema.restaurants.id, id))
        .returning(),
    );
    if (!updated) throw new ServiceError("NOT_FOUND", "Restaurant not found", 404);
    return updated;
  }

  async delete(id: string) {
    const timed = makeTimer(
      `restaurant DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    // Block delete while branches still exist (which would cascade their data).
    const branch = await timed("select restaurant branch", () =>
      db.query.branches.findFirst({
        where: eq(schema.branches.restaurantId, id),
        columns: { id: true },
      }),
    );
    if (branch) {
      throw new ServiceError(
        "BAD_REQUEST",
        "Cannot delete a restaurant that still has branches",
        400,
      );
    }

    const [deleted] = await timed("delete restaurant", () =>
      db.delete(schema.restaurants).where(eq(schema.restaurants.id, id)).returning(),
    );
    if (!deleted) throw new ServiceError("NOT_FOUND", "Restaurant not found", 404);
  }
}

export const restaurantService = new RestaurantService();
