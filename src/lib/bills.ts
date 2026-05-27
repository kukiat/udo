import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { calcTotals, type BillTotals } from "@/lib/utils";

export type BillLineItem = {
  orderNumber: string;
  name: string;
  quantity: number;
  unitPrice: string;
  options: { name: string; price: string }[];
};

export type SessionBill = {
  sessionId: string;
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  restaurantName: string;
  tableNumber: string;
  totals: BillTotals;
  lineItems: BillLineItem[];
};

/**
 * Recompute a session's bill from its (non-cancelled) orders. `discount` is the
 * discount to apply; when omitted the persisted bill's discount is reused.
 */
export async function computeSessionBill(
  sessionId: string,
  discount?: number,
): Promise<SessionBill | null> {
  const session = await db.query.tableSessions.findFirst({
    where: eq(schema.tableSessions.id, sessionId),
    with: {
      branch: {
        columns: { name: true, address: true, settings: true },
        with: { restaurant: { columns: { name: true } } },
      },
      table: { columns: { tableNumber: true } },
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
  });
  if (!session) return null;

  const billableOrders = session.orders.filter((o) => o.status !== "cancelled");
  const subtotal = billableOrders.reduce(
    (sum, o) => sum + parseFloat(o.totalAmount),
    0,
  );

  let appliedDiscount = discount ?? 0;
  if (discount === undefined) {
    const existing = await db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, sessionId),
    });
    appliedDiscount = existing ? parseFloat(existing.discount) : 0;
  }

  const totals = calcTotals(subtotal, session.branch.settings, appliedDiscount);

  const lineItems = billableOrders.flatMap((o) =>
    o.items.map((it) => ({
      orderNumber: o.orderNumber,
      name: it.menuItem.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      options: it.options.map((op) => ({
        name: op.optionItem.name,
        price: op.price,
      })),
    })),
  );

  return {
    sessionId,
    branchId: session.branchId,
    branchName: session.branch.name,
    branchAddress: session.branch.address,
    restaurantName: session.branch.restaurant.name,
    tableNumber: session.table.tableNumber,
    totals,
    lineItems,
  };
}
