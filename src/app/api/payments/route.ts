import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { computeSessionBill } from "@/lib/bills";
import { emitOrderStatusUpdate } from "@/lib/socket";
import { loadOrderDTO } from "@/lib/orders";
import { paymentSchema } from "@/lib/validation";

// Take payment for a table session: recompute the bill, record the payment,
// mark the bill paid, close the session, and free the table.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { data, error } = await parseBody(req, paymentSchema);
    if (error) return error;

    const discount =
      data.discount === undefined || data.discount === null || data.discount === ""
        ? undefined
        : parseFloat(data.discount);

    const computed = await computeSessionBill(data.sessionId, discount);
    if (!computed) return badRequest("Session not found");

    const total = computed.totals.total;
    if (data.method === "cash" && data.tendered) {
      const tendered = parseFloat(data.tendered);
      if (tendered < total) {
        return badRequest("Tendered amount is less than the total due");
      }
    }

    const session = await db.query.tableSessions.findFirst({
      where: eq(schema.tableSessions.id, data.sessionId),
      columns: { id: true, tableId: true, status: true },
    });
    if (!session) return badRequest("Session not found");
    if (session.status === "closed") return badRequest("Session already closed");

    // Resolve the shift to attribute this payment to (explicit, else the
    // cashier's open shift for the branch).
    let shiftId = data.shiftId ?? null;
    if (!shiftId && user) {
      const openShift = await db.query.shifts.findFirst({
        where: and(
          eq(schema.shifts.branchId, computed.branchId),
          eq(schema.shifts.cashierId, user.id),
          eq(schema.shifts.status, "open"),
        ),
        columns: { id: true },
      });
      shiftId = openShift?.id ?? null;
    }

    const tendered =
      data.method === "cash" && data.tendered ? parseFloat(data.tendered) : null;
    const change = tendered !== null ? Math.max(0, tendered - total) : null;

    const result = await db.transaction(async (tx) => {
      const values = {
        subtotal: computed.totals.subtotal.toFixed(2),
        vat: computed.totals.vat.toFixed(2),
        serviceCharge: computed.totals.serviceCharge.toFixed(2),
        discount: computed.totals.discount.toFixed(2),
        totalAmount: total.toFixed(2),
        status: "paid" as const,
      };

      const existing = await tx.query.bills.findFirst({
        where: eq(schema.bills.tableSessionId, data.sessionId),
      });
      let bill;
      if (existing) {
        [bill] = await tx
          .update(schema.bills)
          .set(values)
          .where(eq(schema.bills.id, existing.id))
          .returning();
      } else {
        [bill] = await tx
          .insert(schema.bills)
          .values({ tableSessionId: data.sessionId, ...values })
          .returning();
      }

      const [payment] = await tx
        .insert(schema.payments)
        .values({
          billId: bill.id,
          shiftId,
          cashierId: user?.id ?? null,
          method: data.method,
          amount: total.toFixed(2),
          tendered: tendered !== null ? tendered.toFixed(2) : null,
          change: change !== null ? change.toFixed(2) : null,
        })
        .returning();

      // Close the session and mark its served orders completed.
      await tx
        .update(schema.tableSessions)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(schema.tableSessions.id, data.sessionId));
      await tx
        .update(schema.tables)
        .set({ status: "available" })
        .where(eq(schema.tables.id, session.tableId));
      await tx
        .update(schema.orders)
        .set({ status: "completed" })
        .where(
          and(
            eq(schema.orders.tableSessionId, data.sessionId),
            eq(schema.orders.status, "served"),
          ),
        );

      return { bill, payment };
    });

    // Notify the customer's table that the bill is settled (best-effort).
    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.tableSessionId, data.sessionId),
      columns: { id: true, status: true },
    });
    for (const o of orders.filter((x) => x.status === "completed")) {
      const dto = await loadOrderDTO(o.id);
      if (dto) emitOrderStatusUpdate(dto);
    }

    return Response.json(
      {
        payment: result.payment,
        bill: result.bill,
        receipt: { ...computed, change, tendered, method: data.method },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/payments", err);
    return serverError();
  }
}
