import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { tableUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, tableUpdateSchema);
    if (error) return error;

    const timed = makeTimer(
      `table PATCH ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const current = await timed("select table", () =>
      db.query.tables.findFirst({
        where: eq(schema.tables.id, id),
        columns: { id: true, branchId: true, tableNumber: true },
      }),
    );
    if (!current) return notFound("Table not found");

    // Table numbers are unique per branch.
    const newNumber = data.tableNumber;
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
        return badRequest(
          `Table "${newNumber}" already exists in this branch`,
        );
      }
    }

    const [updated] = await timed("update table", () =>
      db
        .update(schema.tables)
        .set({
          ...(data.tableNumber !== undefined
            ? { tableNumber: data.tableNumber }
            : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        })
        .where(eq(schema.tables.id, id))
        .returning(),
    );
    if (!updated) return notFound("Table not found");
    return Response.json({ table: updated });
  } catch (err) {
    console.error("PATCH /api/tables/[id]", err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

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
      return badRequest("Cannot delete a table that has orders");
    }

    const [deleted] = await timed("delete table", () =>
      db
        .delete(schema.tables)
        .where(eq(schema.tables.id, id))
        .returning(),
    );
    if (!deleted) return notFound("Table not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tables/[id]", err);
    return serverError();
  }
}
