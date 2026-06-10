import { and, eq, gte, lte } from "drizzle-orm";

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
    // Client timezone offset in minutes, as reported by
    // Date.prototype.getTimezoneOffset() (UTC = local + tz). Timestamps are
    // stored in UTC; the offset only shifts day boundaries and byDay buckets
    // so "a day" means a day in the client's local timezone.
    const tzMin = parseInt(searchParams.get("tz") ?? "0", 10) || 0;
    const localDayStart = (ymd: string) =>
      new Date(Date.parse(`${ymd}T00:00:00Z`) + tzMin * 60_000);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam
      ? localDayStart(fromParam)
      : new Date(now.getTime() - 29 * 86_400_000);
    const to = toParam
      ? new Date(localDayStart(toParam).getTime() + 86_400_000 - 1)
      : now;
    if (isNaN(from.getTime()) || isNaN(to.getTime()))
      return badRequest("from/to must be YYYY-MM-DD dates");

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
          cashier: { columns: { id: true, name: true, email: true } },
          shift: {
            columns: {
              id: true,
              status: true,
              openedAt: true,
              closedAt: true,
            },
            with: {
              cashier: { columns: { id: true, name: true, email: true } },
            },
          },
          bill: {
            columns: {
              id: true,
              subtotal: true,
              vat: true,
              serviceCharge: true,
              discount: true,
              totalAmount: true,
              status: true,
            },
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

    const activeSessions = await timed("select active bill statuses", () =>
      db.query.tableSessions.findMany({
        where: and(
          eq(schema.tableSessions.branchId, branchId),
          eq(schema.tableSessions.status, "active"),
        ),
        columns: { id: true },
        with: {
          bill: {
            columns: {
              status: true,
              subtotal: true,
              vat: true,
              serviceCharge: true,
              discount: true,
              totalAmount: true,
            },
          },
        },
      }),
    );

    const scoped = payments.filter(
      (p) => p.bill?.tableSession?.branchId === branchId,
    );

    let totalSales = 0;
    let subtotalTotal = 0;
    let vatTotal = 0;
    let serviceChargeTotal = 0;
    let discountTotal = 0;
    const byDay = new Map<string, number>();
    const byMethod = new Map<string, { total: number; count: number }>();
    const byCategory = new Map<string, { total: number; qty: number }>();
    const byItem = new Map<string, { qty: number; total: number }>();
    const byCashier = new Map<
      string,
      { cashierId: string | null; name: string; total: number; count: number }
    >();
    const byShift = new Map<
      string,
      {
        shiftId: string | null;
        cashierName: string;
        status: string | null;
        openedAt: string | null;
        closedAt: string | null;
        total: number;
        count: number;
        cash: number;
        card: number;
        qr: number;
      }
    >();
    const paidBillIds = new Set<string>();

    for (const p of scoped) {
      const amount = parseFloat(p.amount);
      totalSales += amount;
      if (p.bill) {
        const firstPaymentForBill = !paidBillIds.has(p.bill.id);
        paidBillIds.add(p.bill.id);
        if (firstPaymentForBill) {
          subtotalTotal += parseFloat(p.bill.subtotal);
          vatTotal += parseFloat(p.bill.vat);
          serviceChargeTotal += parseFloat(p.bill.serviceCharge);
          discountTotal += parseFloat(p.bill.discount);
        }
      }

      const day = new Date(p.createdAt.getTime() - tzMin * 60_000)
        .toISOString()
        .slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + amount);

      const m = byMethod.get(p.method) ?? { total: 0, count: 0 };
      m.total += amount;
      m.count += 1;
      byMethod.set(p.method, m);

      const cashierKey = p.cashier?.id ?? "unassigned";
      const cashier = byCashier.get(cashierKey) ?? {
        cashierId: p.cashier?.id ?? null,
        name: p.cashier?.name ?? "Unassigned",
        total: 0,
        count: 0,
      };
      cashier.total += amount;
      cashier.count += 1;
      byCashier.set(cashierKey, cashier);

      const shiftKey = p.shift?.id ?? "no-shift";
      const shift = byShift.get(shiftKey) ?? {
        shiftId: p.shift?.id ?? null,
        cashierName: p.shift?.cashier?.name ?? p.cashier?.name ?? "Unassigned",
        status: p.shift?.status ?? null,
        openedAt: p.shift?.openedAt?.toISOString() ?? null,
        closedAt: p.shift?.closedAt?.toISOString() ?? null,
        total: 0,
        count: 0,
        cash: 0,
        card: 0,
        qr: 0,
      };
      shift.total += amount;
      shift.count += 1;
      if (p.method === "cash") shift.cash += amount;
      if (p.method === "card") shift.card += amount;
      if (p.method === "qr") shift.qr += amount;
      byShift.set(shiftKey, shift);

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

    const activeBillSummary = activeSessions.reduce(
      (acc, s) => {
        const status = s.bill?.status ?? "open";
        if (status === "requested") acc.requested += 1;
        else if (status === "paid") acc.paid += 1;
        else acc.open += 1;
        acc.total += 1;
        acc.activeAmount += parseFloat(s.bill?.totalAmount ?? "0");
        return acc;
      },
      { open: 0, requested: 0, paid: 0, total: 0, activeAmount: 0 },
    );

    const orderCount = scoped.length;
    return Response.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalSales: totalSales.toFixed(2),
        orderCount,
        avgTicket: (orderCount ? totalSales / orderCount : 0).toFixed(2),
        subtotal: subtotalTotal.toFixed(2),
        vat: vatTotal.toFixed(2),
        serviceCharge: serviceChargeTotal.toFixed(2),
        discount: discountTotal.toFixed(2),
      },
      billSummary: {
        activeOpen: activeBillSummary.open,
        activeRequested: activeBillSummary.requested,
        activePaid: activeBillSummary.paid,
        activeTotal: activeBillSummary.total,
        activeAmount: activeBillSummary.activeAmount.toFixed(2),
        paidInRange: paidBillIds.size,
      },
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total: total.toFixed(2) })),
      paymentBreakdown: [...byMethod.entries()].map(([method, v]) => ({
        method,
        total: v.total.toFixed(2),
        count: v.count,
      })),
      cashierBreakdown: [...byCashier.values()]
        .map((v) => ({
          cashierId: v.cashierId,
          name: v.name,
          total: v.total.toFixed(2),
          count: v.count,
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total)),
      shiftBreakdown: [...byShift.values()]
        .map((v) => ({
          shiftId: v.shiftId,
          cashierName: v.cashierName,
          status: v.status,
          openedAt: v.openedAt,
          closedAt: v.closedAt,
          total: v.total.toFixed(2),
          count: v.count,
          cash: v.cash.toFixed(2),
          card: v.card.toFixed(2),
          qr: v.qr.toFixed(2),
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total)),
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
