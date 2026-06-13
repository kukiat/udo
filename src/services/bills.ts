import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { emitBillRequested } from "@/lib/socket";
import { calcTotals, makeTimer } from "@/lib/utils";
import { ServiceError } from "@/services/errors";

// Orders still in the kitchen pipeline — the check can't be requested until
// every order has at least been served.
const UNSERVED = ["pending", "preparing", "ready"] as const;

/**
 * The bill for a table session, recomputed from its (non-cancelled) orders,
 * plus its line items. Creates/refreshes the persisted bill row.
 */
export async function getSessionBill(sessionId: string) {
  const timed = makeTimer(`bills GET ${crypto.randomUUID().slice(0, 8)}`);

  const session = await timed("select session+orders+items", () =>
    db.query.tableSessions.findFirst({
      where: eq(schema.tableSessions.id, sessionId),
      with: {
        branch: { columns: { settings: true } },
        orders: {
          with: {
            items: {
              with: {
                menuItem: { columns: { name: true } },
                options: { with: { optionItem: { columns: { name: true } } } },
              },
            },
          },
        },
      },
    }),
  );
  if (!session) throw new ServiceError("NOT_FOUND", "Session not found", 404);

  // Cancelled orders are excluded from the bill entirely.
  const billableOrders = session.orders.filter((o) => o.status !== "cancelled");
  const subtotal = billableOrders.reduce(
    (sum, o) => sum + parseFloat(o.totalAmount),
    0,
  );

  const existing = await timed("select bill", () =>
    db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, sessionId),
    }),
  );
  const discount = existing ? parseFloat(existing.discount) : 0;
  const totals = calcTotals(subtotal, session.branch.settings, discount);

  const values = {
    subtotal: totals.subtotal.toFixed(2),
    vat: totals.vat.toFixed(2),
    serviceCharge: totals.serviceCharge.toFixed(2),
    discount: totals.discount.toFixed(2),
    totalAmount: totals.total.toFixed(2),
  };
  let bill = existing;
  if (bill) {
    [bill] = await timed("update bill", () =>
      db
        .update(schema.bills)
        .set(values)
        .where(eq(schema.bills.id, bill!.id))
        .returning(),
    );
  } else {
    [bill] = await timed("insert bill", () =>
      db
        .insert(schema.bills)
        .values({ tableSessionId: sessionId, status: "open", ...values })
        .returning(),
    );
  }

  const lineItems = billableOrders.flatMap((o) =>
    o.items.map((it) => ({
      orderNumber: o.orderNumber,
      name: it.menuItem.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      note: it.note,
      options: it.options.map((op) => ({
        name: op.optionItem.name,
        price: op.price,
      })),
    })),
  );

  return { bill, lineItems };
}

/**
 * Mark a session's bill `requested` (the customer asked for the check). Blocked
 * while any order is still unserved. Emits `bill:requested` to floor staff.
 */
export async function requestCheck(sessionId: string) {
  const timed = makeTimer(`request-check POST ${crypto.randomUUID().slice(0, 8)}`);

  const session = await timed("select session", () =>
    db.query.tableSessions.findFirst({
      where: eq(schema.tableSessions.id, sessionId),
      columns: { id: true, branchId: true, tableId: true },
    }),
  );
  if (!session) throw new ServiceError("NOT_FOUND", "Session not found", 404);

  const unserved = await timed("select unserved order", () =>
    db.query.orders.findFirst({
      where: and(
        eq(schema.orders.tableSessionId, sessionId),
        inArray(schema.orders.status, [...UNSERVED]),
      ),
      columns: { id: true },
    }),
  );
  if (unserved) {
    throw new ServiceError(
      "ORDERS_NOT_SERVED",
      "Some orders haven’t been served yet. Please wait until all items arrive before requesting the check.",
      409,
    );
  }

  const existing = await timed("select bill", () =>
    db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, sessionId),
    }),
  );

  let bill = existing;
  if (bill) {
    [bill] = await timed("update bill requested", () =>
      db
        .update(schema.bills)
        .set({ status: "requested" })
        .where(eq(schema.bills.id, bill!.id))
        .returning(),
    );
  } else {
    // No bill computed yet — create a placeholder in requested state.
    [bill] = await timed("insert bill requested", () =>
      db
        .insert(schema.bills)
        .values({ tableSessionId: sessionId, status: "requested" })
        .returning(),
    );
  }

  emitBillRequested(session.branchId, sessionId, session.tableId);

  return bill;
}
