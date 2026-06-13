import { and, asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import type {
  TableCreateInput,
  TableLayoutInput,
  TableUpdateInput,
} from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export async function listTables(branchId: string) {
  const timed = makeTimer(`tables GET ${crypto.randomUUID().slice(0, 8)}`);
  return timed("select tables", () =>
    db.query.tables.findMany({
      where: eq(schema.tables.branchId, branchId),
      orderBy: [asc(schema.tables.tableNumber)],
    }),
  );
}

export async function createTable(input: TableCreateInput) {
  const timed = makeTimer(`tables POST ${crypto.randomUUID().slice(0, 8)}`);

  // Table numbers are unique per branch.
  const existing = await timed("select existing table", () =>
    db.query.tables.findFirst({
      where: and(
        eq(schema.tables.branchId, input.branchId),
        eq(schema.tables.tableNumber, input.tableNumber),
      ),
      columns: { id: true },
    }),
  );
  if (existing) {
    throw new ServiceError(
      "BAD_REQUEST",
      `Table "${input.tableNumber}" already exists in this branch`,
      400,
    );
  }

  const [created] = await timed("insert table", () =>
    db
      .insert(schema.tables)
      .values({
        branchId: input.branchId,
        tableNumber: input.tableNumber,
        ...(input.seats !== undefined ? { seats: input.seats } : {}),
        ...(input.shape !== undefined ? { shape: input.shape } : {}),
      })
      .returning(),
  );
  return created;
}

export async function updateTable(id: string, input: TableUpdateInput) {
  const timed = makeTimer(
    `table PATCH ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  const current = await timed("select table", () =>
    db.query.tables.findFirst({
      where: eq(schema.tables.id, id),
      columns: { id: true, branchId: true, tableNumber: true },
    }),
  );
  if (!current) throw new ServiceError("NOT_FOUND", "Table not found", 404);

  // Table numbers are unique per branch.
  const newNumber = input.tableNumber;
  if (newNumber !== undefined && newNumber !== current.tableNumber) {
    const existing = await timed("select duplicate table", () =>
      db.query.tables.findFirst({
        where: and(
          eq(schema.tables.branchId, current.branchId),
          eq(schema.tables.tableNumber, newNumber),
        ),
        columns: { id: true },
      }),
    );
    if (existing) {
      throw new ServiceError(
        "BAD_REQUEST",
        `Table "${newNumber}" already exists in this branch`,
        400,
      );
    }
  }

  const [updated] = await timed("update table", () =>
    db
      .update(schema.tables)
      .set({
        ...(input.tableNumber !== undefined
          ? { tableNumber: input.tableNumber }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .where(eq(schema.tables.id, id))
      .returning(),
  );
  if (!updated) throw new ServiceError("NOT_FOUND", "Table not found", 404);
  return updated;
}

export async function deleteTable(id: string) {
  const timed = makeTimer(
    `table DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  // Orders reference tables with onDelete: restrict — block if any exist.
  const order = await timed("select table order", () =>
    db.query.orders.findFirst({
      where: eq(schema.orders.tableId, id),
      columns: { id: true },
    }),
  );
  if (order) {
    throw new ServiceError(
      "BAD_REQUEST",
      "Cannot delete a table that has orders",
      400,
    );
  }

  const [deleted] = await timed("delete table", () =>
    db.delete(schema.tables).where(eq(schema.tables.id, id)).returning(),
  );
  if (!deleted) throw new ServiceError("NOT_FOUND", "Table not found", 404);
}

/** Bulk-save floor plan layout for a branch's tables. */
export async function saveTableLayout(input: TableLayoutInput) {
  const timed = makeTimer(`layout PUT ${crypto.randomUUID().slice(0, 8)}`);

  const ids = input.tables.map((t) => t.id);
  const owned = await timed("select branch tables", () =>
    db.query.tables.findMany({
      where: and(
        eq(schema.tables.branchId, input.branchId),
        inArray(schema.tables.id, ids),
      ),
      columns: { id: true },
    }),
  );
  if (owned.length !== ids.length) {
    throw new ServiceError(
      "BAD_REQUEST",
      "Some tables do not belong to this branch",
      400,
    );
  }

  const zoneIds = [
    ...new Set(input.tables.flatMap((t) => (t.zoneId ? [t.zoneId] : []))),
  ];
  if (zoneIds.length > 0) {
    const zones = await timed("select zones", () =>
      db.query.floorZones.findMany({
        where: and(
          eq(schema.floorZones.branchId, input.branchId),
          inArray(schema.floorZones.id, zoneIds),
        ),
        columns: { id: true },
      }),
    );
    if (zones.length !== zoneIds.length) {
      throw new ServiceError(
        "BAD_REQUEST",
        "Some zones do not belong to this branch",
        400,
      );
    }
  }

  await timed("update layout", () =>
    db.transaction(async (tx) => {
      for (const t of input.tables) {
        await tx
          .update(schema.tables)
          .set({
            zoneId: t.zoneId,
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            shape: t.shape,
            seats: t.seats,
            rotation: t.rotation,
          })
          .where(eq(schema.tables.id, t.id));
      }
    }),
  );

  return timed("reselect tables", () =>
    db.query.tables.findMany({
      where: eq(schema.tables.branchId, input.branchId),
    }),
  );
}
