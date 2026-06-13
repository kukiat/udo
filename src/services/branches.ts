import { and, asc, count, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import type { BranchCreateInput, BranchUpdateInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export const DEFAULT_BRANCH_SETTINGS = {
  maxKdsScreens: 3,
  vatRate: 0.07,
  serviceChargeRate: 0,
};

/** Normalize a list of table-number strings: trim, drop blanks, dedupe. */
export function normalizeTableNumbers(numbers: string[] | undefined): string[] {
  return Array.from(new Set((numbers ?? []).map((n) => n.trim()).filter(Boolean)));
}

export async function listBranches(opts: {
  restaurantId: string | null;
  withRestaurant: boolean;
  limit?: number;
  offset: number;
  hasLimit: boolean;
}) {
  const where = opts.restaurantId
    ? eq(schema.branches.restaurantId, opts.restaurantId)
    : undefined;

  const timed = makeTimer(`branches GET ${crypto.randomUUID().slice(0, 8)}`);

  const rows = await timed("select branches", () =>
    db.query.branches.findMany({
      where,
      orderBy: [asc(schema.branches.name)],
      with: opts.withRestaurant
        ? { restaurant: { columns: { id: true, name: true } } }
        : undefined,
      limit: opts.limit,
      offset: opts.hasLimit ? opts.offset : undefined,
    }),
  );

  const [{ value: total } = { value: 0 }] = await timed("count branches", () =>
    db.select({ value: count() }).from(schema.branches).where(where),
  );

  return { branches: rows, total };
}

export async function createBranch(input: BranchCreateInput) {
  const scope = `branches POST ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);
  const txStart = performance.now();
  const created = await db.transaction(async (tx) => {
    const [branch] = await timed("insert branch", () =>
      tx
        .insert(schema.branches)
        .values({
          restaurantId: input.restaurantId,
          name: input.name,
          address: input.address ?? null,
          openingTime: input.openingTime ?? null,
          closingTime: input.closingTime ?? null,
          settings: input.settings ?? DEFAULT_BRANCH_SETTINGS,
        })
        .returning(),
    );

    const numbers = normalizeTableNumbers(input.tables);
    if (numbers.length > 0) {
      await timed("insert tables", () =>
        tx
          .insert(schema.tables)
          .values(numbers.map((tableNumber) => ({ branchId: branch.id, tableNumber }))),
      );
    }

    return branch;
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );
  return created;
}

export async function getBranch(id: string) {
  const timed = makeTimer(
    `branch GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );
  const branch = await timed("select branch", () =>
    db.query.branches.findFirst({
      where: eq(schema.branches.id, id),
      with: { restaurant: { columns: { name: true } } },
    }),
  );
  if (!branch) throw new ServiceError("NOT_FOUND", "Branch not found", 404);
  return branch;
}

export async function updateBranch(id: string, input: BranchUpdateInput) {
  const scope = `branch PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);
  const txStart = performance.now();
  const updated = await db.transaction(async (tx) => {
    const [branch] = await timed("update branch", () =>
      tx
        .update(schema.branches)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.address !== undefined && { address: input.address ?? null }),
          ...(input.openingTime !== undefined && {
            openingTime: input.openingTime ?? null,
          }),
          ...(input.closingTime !== undefined && {
            closingTime: input.closingTime ?? null,
          }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.settings !== undefined && { settings: input.settings }),
        })
        .where(eq(schema.branches.id, id))
        .returning(),
    );
    if (!branch) return null;

    // Add-only table reconciliation: create any supplied numbers that don't
    // already exist on the branch. Existing tables are never deleted here so
    // sessions/orders attached to them stay intact.
    if (input.tables) {
      const desired = normalizeTableNumbers(input.tables);
      if (desired.length > 0) {
        const existing = await timed("select existing tables", () =>
          tx.query.tables.findMany({
            where: and(
              eq(schema.tables.branchId, id),
              inArray(schema.tables.tableNumber, desired),
            ),
            columns: { tableNumber: true },
          }),
        );
        const have = new Set(existing.map((t) => t.tableNumber));
        const toAdd = desired.filter((n) => !have.has(n));
        if (toAdd.length > 0) {
          await timed("insert tables", () =>
            tx
              .insert(schema.tables)
              .values(toAdd.map((tableNumber) => ({ branchId: id, tableNumber }))),
          );
        }
      }
    }

    return branch;
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );

  if (!updated) throw new ServiceError("NOT_FOUND", "Branch not found", 404);
  return updated;
}

export async function deleteBranch(id: string) {
  const timed = makeTimer(
    `branch DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  // Protect transactional data: block delete if the branch has any orders.
  const order = await timed("select branch order", () =>
    db.query.orders.findFirst({
      where: eq(schema.orders.branchId, id),
      columns: { id: true },
    }),
  );
  if (order) {
    throw new ServiceError(
      "BAD_REQUEST",
      "Cannot delete a branch that has orders",
      400,
    );
  }

  const [deleted] = await timed("delete branch", () =>
    db.delete(schema.branches).where(eq(schema.branches.id, id)).returning(),
  );
  if (!deleted) throw new ServiceError("NOT_FOUND", "Branch not found", 404);
}
