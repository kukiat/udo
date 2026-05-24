import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  notFound,
  parseBody,
  serverError,
} from "@/lib/api";
import { canCancel, loadOrderDTO } from "@/lib/orders";
import { emitOrderStatusUpdate } from "@/lib/socket";
import { orderCancelSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, orderCancelSchema);
    if (error) return error;

    const current = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
      columns: { status: true, tableSessionId: true },
    });
    if (!current) return notFound("Order not found");

    if (!canCancel(current.status)) {
      return badRequest(
        `Order cannot be cancelled once it is ${current.status}`,
      );
    }

    // Once the check has been requested (or the bill is paid), the table is
    // closing out — orders can no longer be cancelled.
    const bill = await db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, current.tableSessionId),
      columns: { status: true },
    });
    if (bill && bill.status !== "open") {
      return errorResponse(
        "BILL_LOCKED",
        "The check has been requested for this table. Please ask staff to reopen the bill before changing orders.",
        409,
      );
    }

    await db
      .update(schema.orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: data.reason ?? null,
      })
      .where(eq(schema.orders.id, id));

    const dto = await loadOrderDTO(id);
    if (dto) emitOrderStatusUpdate(dto);
    return Response.json({ order: dto });
  } catch (err) {
    console.error("POST /api/orders/[id]/cancel", err);
    return serverError();
  }
}
