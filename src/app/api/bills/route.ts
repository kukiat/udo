import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, serverError } from "@/lib/api";
import { calcTotals, makeTimer } from "@/lib/utils";

// Returns the bill for a table session, recomputed from its orders, plus the
// line items. Creates/refreshes the persisted bill row.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return badRequest("sessionId is required");

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
                  options: {
                    with: { optionItem: { columns: { name: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    );
    if (!session) return notFound("Session not found");

    // Cancelled orders are excluded from the bill entirely.
    const billableOrders = session.orders.filter(
      (o) => o.status !== "cancelled",
    );

    const subtotal = billableOrders.reduce(
      (sum, o) => sum + parseFloat(o.totalAmount),
      0,
    );
    const settings = session.branch.settings;

    const existing = await timed("select bill", () =>
      db.query.bills.findFirst({
        where: eq(schema.bills.tableSessionId, sessionId),
      }),
    );
    const discount = existing ? parseFloat(existing.discount) : 0;
    const totals = calcTotals(subtotal, settings, discount);

    let bill = existing;
    const values = {
      subtotal: totals.subtotal.toFixed(2),
      vat: totals.vat.toFixed(2),
      serviceCharge: totals.serviceCharge.toFixed(2),
      discount: totals.discount.toFixed(2),
      totalAmount: totals.total.toFixed(2),
    };
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

    return Response.json({ bill, lineItems });
  } catch (err) {
    console.error("GET /api/bills", err);
    return serverError();
  }
}
