import { and, gte, lte } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";

// Sales analytics for a branch over a date range, derived from recorded
// payments (actual revenue) and the order items behind each paid bill.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const now = new Date();
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(now.getTime() - 29 * 86_400_000);
    const to = searchParams.get("to")
      ? new Date(new Date(searchParams.get("to")!).setHours(23, 59, 59, 999))
      : now;

    const timed = makeTimer(
      `reports-sales GET ${crypto.randomUUID().slice(0, 8)}`,
    );
    const payments = await timed("select payments+bills+orders", () =>
      db.query.payments.findMany({
        where: and(
          gte(schema.payments.createdAt, from),
          lte(schema.payments.createdAt, to),
        ),
        with: {
          bill: {
            with: {
              tableSession: {
                columns: { branchId: true },
                with: {
                  orders: {
                    with: {
                      items: {
                        with: {
                          menuItem: {
                            columns: { name: true },
                            with: { category: { columns: { name: true } } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );

    const scoped = payments.filter(
      (p) => p.bill?.tableSession?.branchId === branchId,
    );

    let totalSales = 0;
    const byDay = new Map<string, number>();
    const byMethod = new Map<string, { total: number; count: number }>();
    const byCategory = new Map<string, { total: number; qty: number }>();
    const byItem = new Map<string, { qty: number; total: number }>();

    for (const p of scoped) {
      const amount = parseFloat(p.amount);
      totalSales += amount;

      const day = p.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + amount);

      const m = byMethod.get(p.method) ?? { total: 0, count: 0 };
      m.total += amount;
      m.count += 1;
      byMethod.set(p.method, m);

      const orders = (p.bill?.tableSession?.orders ?? []).filter(
        (o) => o.status !== "cancelled",
      );
      for (const o of orders) {
        for (const it of o.items) {
          const lineTotal = parseFloat(it.unitPrice) * it.quantity;
          const catName = it.menuItem.category?.name ?? "Uncategorized";
          const c = byCategory.get(catName) ?? { total: 0, qty: 0 };
          c.total += lineTotal;
          c.qty += it.quantity;
          byCategory.set(catName, c);

          const i = byItem.get(it.menuItem.name) ?? { qty: 0, total: 0 };
          i.qty += it.quantity;
          i.total += lineTotal;
          byItem.set(it.menuItem.name, i);
        }
      }
    }

    const orderCount = scoped.length;
    return Response.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalSales: totalSales.toFixed(2),
        orderCount,
        avgTicket: (orderCount ? totalSales / orderCount : 0).toFixed(2),
      },
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total: total.toFixed(2) })),
      paymentBreakdown: [...byMethod.entries()].map(([method, v]) => ({
        method,
        total: v.total.toFixed(2),
        count: v.count,
      })),
      byCategory: [...byCategory.entries()]
        .map(([name, v]) => ({ name, total: v.total.toFixed(2), qty: v.qty }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total)),
      topItems: [...byItem.entries()]
        .map(([name, v]) => ({ name, qty: v.qty, total: v.total.toFixed(2) }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10),
    });
  } catch (err) {
    console.error("GET /api/reports/sales", err);
    return serverError();
  }
}
