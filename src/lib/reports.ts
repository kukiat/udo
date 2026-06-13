import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";

export type ReportRange = { from: Date; to: Date };

/**
 * Resolve a report date range from query params. Timestamps are stored in UTC;
 * `tzMin` (the client's `Date.prototype.getTimezoneOffset()`, UTC = local + tz)
 * shifts day boundaries so a range covers whole days in the client's local
 * timezone. Defaults to the last `defaultDaysBack` days ending now. Returns
 * `null` when an explicit from/to is present but unparseable.
 */
export function resolveReportRange(opts: {
  fromParam: string | null;
  toParam: string | null;
  tzMin: number;
  defaultDaysBack: number;
}): ReportRange | null {
  const { fromParam, toParam, tzMin, defaultDaysBack } = opts;
  const now = new Date();
  const localDayStart = (ymd: string) =>
    new Date(Date.parse(`${ymd}T00:00:00Z`) + tzMin * 60_000);
  const from = fromParam
    ? localDayStart(fromParam)
    : new Date(now.getTime() - defaultDaysBack * 86_400_000);
  const to = toParam
    ? new Date(localDayStart(toParam).getTime() + 86_400_000 - 1)
    : now;
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return { from, to };
}

/**
 * Sales analytics for a branch over a date range, derived from recorded
 * payments (actual revenue) and the order items behind each paid bill. The
 * returned shape is the `SalesReport` the dashboard renders (and feeds to the
 * reports agent as grounding context).
 */
export async function computeSalesReport(
  branchId: string,
  range: ReportRange,
  tzMin: number,
) {
  const { from, to } = range;
  const timed = makeTimer(`reports-sales ${crypto.randomUUID().slice(0, 8)}`);

  const payments = await timed("select payments+bills+orders", () =>
    db.query.payments.findMany({
      where: and(
        gte(schema.payments.createdAt, from),
        lte(schema.payments.createdAt, to),
      ),
      with: {
        cashier: { columns: { id: true, name: true, email: true } },
        shift: {
          columns: { id: true, status: true, openedAt: true, closedAt: true },
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
  return {
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
  };
}

export type SalesReport = Awaited<ReturnType<typeof computeSalesReport>>;

/**
 * Per-branch sales comparison for a restaurant over a date range, derived from
 * recorded payments (actual revenue). One aggregate query for all branches;
 * branches with no payments in range are returned with zeros.
 */
export async function computeBranchSalesReport(
  restaurantId: string,
  range: ReportRange,
  tzMin: number,
) {
  const { from, to } = range;

  // Day bucket in the client's local timezone (see byDay in computeSalesReport)
  // — convert to naive UTC first so to_char is not affected by the server's
  // TimeZone setting. tzMin is inlined (it is a parsed integer) so the SELECT
  // and GROUP BY expressions are textually identical — as bound params Postgres
  // treats $1/$2 as different expressions and rejects the grouping.
  const dayExpr = sql<string>`to_char((${schema.payments.createdAt} at time zone 'UTC') - make_interval(mins => ${sql.raw(String(tzMin))}), 'YYYY-MM-DD')`;
  const scopeFilter = and(
    eq(schema.branches.restaurantId, restaurantId),
    gte(schema.payments.createdAt, from),
    lte(schema.payments.createdAt, to),
  );

  const [branchRows, totals, dayRows] = await Promise.all([
    db.query.branches.findMany({
      where: eq(schema.branches.restaurantId, restaurantId),
      columns: { id: true, name: true },
      orderBy: asc(schema.branches.name),
    }),
    db
      .select({
        branchId: schema.tableSessions.branchId,
        total: sql<string>`coalesce(sum(${schema.payments.amount}), 0)`,
        paymentCount: sql<number>`count(*)::int`,
        paidBills: sql<number>`count(distinct ${schema.payments.billId})::int`,
      })
      .from(schema.payments)
      .innerJoin(schema.bills, eq(schema.payments.billId, schema.bills.id))
      .innerJoin(
        schema.tableSessions,
        eq(schema.bills.tableSessionId, schema.tableSessions.id),
      )
      .innerJoin(
        schema.branches,
        eq(schema.tableSessions.branchId, schema.branches.id),
      )
      .where(scopeFilter)
      .groupBy(schema.tableSessions.branchId),
    db
      .select({
        branchId: schema.tableSessions.branchId,
        date: dayExpr,
        total: sql<string>`coalesce(sum(${schema.payments.amount}), 0)`,
      })
      .from(schema.payments)
      .innerJoin(schema.bills, eq(schema.payments.billId, schema.bills.id))
      .innerJoin(
        schema.tableSessions,
        eq(schema.bills.tableSessionId, schema.tableSessions.id),
      )
      .innerJoin(
        schema.branches,
        eq(schema.tableSessions.branchId, schema.branches.id),
      )
      .where(scopeFilter)
      .groupBy(schema.tableSessions.branchId, dayExpr),
  ]);

  const byBranch = new Map(totals.map((t) => [t.branchId, t]));
  const daysByBranch = new Map<string, { date: string; total: string }[]>();
  for (const d of dayRows) {
    const list = daysByBranch.get(d.branchId) ?? [];
    list.push({ date: d.date, total: parseFloat(d.total).toFixed(2) });
    daysByBranch.set(d.branchId, list);
  }
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    branches: branchRows.map((b) => {
      const t = byBranch.get(b.id);
      return {
        branchId: b.id,
        name: b.name,
        total: parseFloat(t?.total ?? "0").toFixed(2),
        paymentCount: t?.paymentCount ?? 0,
        paidBills: t?.paidBills ?? 0,
        byDay: (daysByBranch.get(b.id) ?? []).sort((a, c) =>
          a.date.localeCompare(c.date),
        ),
      };
    }),
  };
}
