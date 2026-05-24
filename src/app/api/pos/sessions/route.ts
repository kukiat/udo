import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, serverError } from "@/lib/api";

// Active table sessions for a branch, with running totals — the cashier's
// worklist. Excludes cancelled orders from the total.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const sessions = await db.query.tableSessions.findMany({
      where: and(
        eq(schema.tableSessions.branchId, branchId),
        eq(schema.tableSessions.status, "active"),
      ),
      with: {
        table: { columns: { tableNumber: true } },
        bill: { columns: { status: true } },
        orders: { columns: { status: true, totalAmount: true } },
      },
    });

    const result = sessions
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
        };
      })
      .sort((a, b) => Number(a.tableNumber) - Number(b.tableNumber));

    return Response.json({ sessions: result });
  } catch (err) {
    console.error("GET /api/pos/sessions", err);
    return serverError();
  }
}
