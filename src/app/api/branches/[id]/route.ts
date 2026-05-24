import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { branchUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const branch = await db.query.branches.findFirst({
      where: eq(schema.branches.id, id),
      with: { restaurant: { columns: { name: true } } },
    });
    if (!branch) return notFound("Branch not found");
    return Response.json({ branch });
  } catch (err) {
    console.error("GET /api/branches/[id]", err);
    return serverError();
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, branchUpdateSchema);
    if (error) return error;

    const [updated] = await db
      .update(schema.branches)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address ?? null }),
        ...(data.settings !== undefined && { settings: data.settings }),
      })
      .where(eq(schema.branches.id, id))
      .returning();
    if (!updated) return notFound("Branch not found");
    return Response.json({ branch: updated });
  } catch (err) {
    console.error("PUT /api/branches/[id]", err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Protect transactional data: block delete if the branch has any orders.
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.branchId, id),
      columns: { id: true },
    });
    if (order) {
      return badRequest("Cannot delete a branch that has orders");
    }

    const [deleted] = await db
      .delete(schema.branches)
      .where(eq(schema.branches.id, id))
      .returning();
    if (!deleted) return notFound("Branch not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/branches/[id]", err);
    return serverError();
  }
}
