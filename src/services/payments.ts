import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { AuthUser } from "@/lib/auth";
import { computeSessionBill } from "@/lib/bills";
import { loadOrderDTO } from "@/lib/orders";
import { emitBillPaid, emitOrderStatusUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import type { PaymentInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export type SettlementResult = {
  payment: typeof schema.payments.$inferSelect;
  bill: typeof schema.bills.$inferSelect;
  receipt: Awaited<ReturnType<typeof computeSessionBill>> & {
    change: number | null;
    tendered: number | null;
    method: PaymentInput["method"];
  };
};

/**
 * Take payment for a table session: recompute the bill from its non-cancelled
 * orders, record the payment against the resolving shift, and atomically close
 * out the visit — mark the bill paid, close the session, free the table, and
 * complete its served orders. Emits `order:status-update` per completed order
 * and `bill:paid` after commit. Throws BAD_REQUEST on validation failures.
 */
export async function settleSession(
  input: PaymentInput,
  { user }: { user: AuthUser | null },
): Promise<SettlementResult> {
  const scope = `payments POST ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);

  const discount =
    input.discount === undefined ||
    input.discount === null ||
    input.discount === ""
      ? undefined
      : parseFloat(input.discount);

  const computed = await timed("compute session bill", () =>
    computeSessionBill(input.sessionId, discount),
  );
  if (!computed) throw new ServiceError("BAD_REQUEST", "Session not found", 400);

  const total = computed.totals.total;
  if (input.method === "cash" && input.tendered) {
    const tenderedAmt = parseFloat(input.tendered);
    if (tenderedAmt < total) {
      throw new ServiceError(
        "BAD_REQUEST",
        "Tendered amount is less than the total due",
        400,
      );
    }
  }

  const session = await timed("select session", () =>
    db.query.tableSessions.findFirst({
      where: eq(schema.tableSessions.id, input.sessionId),
      columns: { id: true, tableId: true, status: true },
    }),
  );
  if (!session) throw new ServiceError("BAD_REQUEST", "Session not found", 400);
  if (session.status === "closed") {
    throw new ServiceError("BAD_REQUEST", "Session already closed", 400);
  }

  // Resolve the shift to attribute this payment to (explicit, else the
  // cashier's open shift for the branch).
  let shiftId = input.shiftId ?? null;
  if (!shiftId && user) {
    const openShift = await timed("select open shift", () =>
      db.query.shifts.findFirst({
        where: and(
          eq(schema.shifts.branchId, computed.branchId),
          eq(schema.shifts.cashierId, user.id),
          eq(schema.shifts.status, "open"),
        ),
        columns: { id: true },
      }),
    );
    shiftId = openShift?.id ?? null;
  }

  const tendered =
    input.method === "cash" && input.tendered ? parseFloat(input.tendered) : null;
  const change = tendered !== null ? Math.max(0, tendered - total) : null;

  const txStart = performance.now();
  const result = await db.transaction(async (tx) => {
    const values = {
      subtotal: computed.totals.subtotal.toFixed(2),
      vat: computed.totals.vat.toFixed(2),
      serviceCharge: computed.totals.serviceCharge.toFixed(2),
      discount: computed.totals.discount.toFixed(2),
      totalAmount: total.toFixed(2),
      status: "paid" as const,
    };

    const existing = await timed("select bill", () =>
      tx.query.bills.findFirst({
        where: eq(schema.bills.tableSessionId, input.sessionId),
      }),
    );
    let bill;
    if (existing) {
      [bill] = await timed("update bill paid", () =>
        tx
          .update(schema.bills)
          .set(values)
          .where(eq(schema.bills.id, existing.id))
          .returning(),
      );
    } else {
      [bill] = await timed("insert bill paid", () =>
        tx
          .insert(schema.bills)
          .values({ tableSessionId: input.sessionId, ...values })
          .returning(),
      );
    }

    const [payment] = await timed("insert payment", () =>
      tx
        .insert(schema.payments)
        .values({
          billId: bill.id,
          shiftId,
          cashierId: user?.id ?? null,
          method: input.method,
          amount: total.toFixed(2),
          tendered: tendered !== null ? tendered.toFixed(2) : null,
          change: change !== null ? change.toFixed(2) : null,
        })
        .returning(),
    );

    // Close the session and mark its served orders completed.
    await timed("close session", () =>
      tx
        .update(schema.tableSessions)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(schema.tableSessions.id, input.sessionId)),
    );
    await timed("free table", () =>
      tx
        .update(schema.tables)
        .set({ status: "available" })
        .where(eq(schema.tables.id, session.tableId)),
    );
    await timed("complete served orders", () =>
      tx
        .update(schema.orders)
        .set({ status: "completed" })
        .where(
          and(
            eq(schema.orders.tableSessionId, input.sessionId),
            eq(schema.orders.status, "served"),
          ),
        ),
    );

    return { bill, payment };
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );

  // Notify the customer's table that the bill is settled (best-effort).
  const orders = await timed("select session orders", () =>
    db.query.orders.findMany({
      where: eq(schema.orders.tableSessionId, input.sessionId),
      columns: { id: true, status: true },
    }),
  );
  for (const o of orders.filter((x) => x.status === "completed")) {
    const dto = await timed("load order dto", () => loadOrderDTO(o.id));
    if (dto) emitOrderStatusUpdate(dto);
  }
  emitBillPaid(computed.branchId, input.sessionId, session.tableId);

  return {
    payment: result.payment,
    bill: result.bill,
    receipt: { ...computed, change, tendered, method: input.method },
  };
}
