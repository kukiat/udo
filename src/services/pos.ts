import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";

/**
 * Active table sessions for a branch with running totals — the cashier's
 * worklist. Cancelled orders are excluded from the total; results are ordered
 * by table number.
 */
export async function listPosSessions(branchId: string) {
  const timed = makeTimer(`pos-sessions GET ${crypto.randomUUID().slice(0, 8)}`);
  const sessions = await timed("select active sessions", () =>
    db.query.tableSessions.findMany({
      where: and(
        eq(schema.tableSessions.branchId, branchId),
        eq(schema.tableSessions.status, "active"),
      ),
      with: {
        table: { columns: { tableNumber: true } },
        bill: { columns: { status: true } },
        orders: { columns: { status: true, totalAmount: true } },
      },
    }),
  );

  return sessions
    .map((s) => {
      const orders = s.orders.filter((o) => o.status !== "cancelled");
      const subtotal = orders.reduce(
        (sum, o) => sum + parseFloat(o.totalAmount),
        0,
      );
      return {
        sessionId: s.id,
        tableId: s.tableId,
        tableNumber: s.table.tableNumber,
        orderCount: orders.length,
        subtotal: subtotal.toFixed(2),
        billStatus: s.bill?.status ?? "open",
        createdAt: s.createdAt.toISOString(),
        seatedAt: s.seatedAt.toISOString(),
        partySize: s.partySize,
        tableNote: s.tableNote,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        expectedLeaveAt: s.expectedLeaveAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));
}
