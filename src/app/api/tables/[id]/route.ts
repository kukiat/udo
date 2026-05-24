import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { tableStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, tableStatusSchema);
    if (error) return error;

    const [updated] = await db
      .update(schema.tables)
      .set({ status: data.status })
      .where(eq(schema.tables.id, id))
      .returning();
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

    // Orders reference tables with onDelete: restrict — block if any exist.
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.tableId, id),
      columns: { id: true },
    });
    if (order) {
      return badRequest("Cannot delete a table that has orders");
    }

    const [deleted] = await db
      .delete(schema.tables)
      .where(eq(schema.tables.id, id))
      .returning();
    if (!deleted) return notFound("Table not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tables/[id]", err);
    return serverError();
  }
}
