import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { canTransition, loadOrderDTO } from "@/lib/orders";
import { emitOrderStatusUpdate } from "@/lib/socket";
import { orderStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, orderStatusSchema);
    if (error) return error;

    const current = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      columns: { status: true },
    });
    if (!current) return notFound("Order not found");

    if (current.status !== data.status && !canTransition(current.status, data.status)) {
      return badRequest(
        `Invalid status transition: ${current.status} → ${data.status}`,
      );
    }

    await db
      .update(schema.orders)
      .set({ status: data.status })
      .where(eq(schema.orders.id, id));

    const dto = await loadOrderDTO(id);
    if (dto) emitOrderStatusUpdate(dto);
    return Response.json({ order: dto });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/status", err);
    return serverError();
  }
}
