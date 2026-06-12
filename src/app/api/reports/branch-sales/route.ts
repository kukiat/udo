import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, serverError } from "@/lib/api";

// Per-branch sales comparison for a restaurant over a date range, derived
// from recorded payments (actual revenue). One aggregate query for all
// branches; branches with no payments in range are returned with zeros.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const now = new Date();
    // Client timezone offset in minutes (see /api/reports/sales) — shifts
    // day boundaries so the range covers whole days in the client's zone.
    const tzMin = parseInt(searchParams.get("tz") ?? "0", 10) || 0;
    const localDayStart = (ymd: string) =>
      new Date(Date.parse(`${ymd}T00:00:00Z`) + tzMin * 60_000);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam
      ? localDayStart(fromParam)
      : new Date(now.getTime() - 6 * 86_400_000);
    const to = toParam
      ? new Date(localDayStart(toParam).getTime() + 86_400_000 - 1)
      : now;
    if (isNaN(from.getTime()) || isNaN(to.getTime()))
      return badRequest("from/to must be YYYY-MM-DD dates");

    // Day bucket in the client's local timezone (see byDay in
    // /api/reports/sales) — convert to naive UTC first so to_char is not
    // affected by the server's TimeZone setting.
    // tzMin is inlined (it is a parsed integer) so the SELECT and GROUP BY
    // expressions are textually identical — as bound params Postgres treats
    // $1/$2 as different expressions and rejects the grouping.
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
        .innerJoin(
          schema.bills,
          eq(schema.payments.billId, schema.bills.id),
        )
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
        .innerJoin(
          schema.bills,
          eq(schema.payments.billId, schema.bills.id),
        )
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
    return Response.json({
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
    });
  } catch (err) {
    console.error("GET /api/reports/branch-sales", err);
    return serverError();
  }
}
