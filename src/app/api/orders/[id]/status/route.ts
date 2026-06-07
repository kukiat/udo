import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { canTransition, loadOrderDTO } from "@/lib/orders";
import { emitOrderStatusUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { orderStatusSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, orderStatusSchema);
    if (error) return error;

    const timed = makeTimer(
      `order-status PATCH ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const current = await timed("select order status", () =>
      db.query.orders.findFirst({
        where: eq(schema.orders.id, id),
        columns: { status: true },
      }),
    );
    if (!current) return notFound("Order not found");

    if (current.status !== data.status && !canTransition(current.status, data.status)) {
      return badRequest(
        `Invalid status transition: ${current.status} → ${data.status}`,
      );
    }

    await timed("update order status", () =>
      db
        .update(schema.orders)
        .set({ status: data.status })
        .where(eq(schema.orders.id, id)),
    );

    const dto = await timed("load order dto", () => loadOrderDTO(id));
    if (dto) emitOrderStatusUpdate(dto, req.headers.get("x-rms-socket-id"));
    return Response.json({ order: dto });
  } catch (err) {
    console.error("PATCH /api/orders/[id]/status", err);
    return serverError();
  }
}
