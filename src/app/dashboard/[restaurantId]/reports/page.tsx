"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorState, Loading } from "@/components/ui/States";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type SalesReport = {
  range: { from: string; to: string };
  summary: { totalSales: string; orderCount: number; avgTicket: string };
  byDay: { date: string; total: string }[];
  paymentBreakdown: { method: string; total: string; count: number }[];
  byCategory: { name: string; total: string; qty: number }[];
  topItems: { name: string; qty: number; total: string }[];
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  qr: "QR / e-wallet",
};

export default function ReportsPage() {
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    api<SalesReport>(
      `/api/reports/sales?branchId=${branchId}&from=${from}&to=${to}`,
    )
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [branchId, from, to]);

  useEffect(load, [load]);

  if (ctxLoading) return <Loading />;

  const maxDay = data
    ? Math.max(1, ...data.byDay.map((d) => parseFloat(d.total)))
    : 1;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Sales Reports</h1>
          <p className="text-sm text-ink-muted">{branchName ?? "—"}</p>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            To
            <input
              type="date"
              value={to}
              max={todayISO()}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {loading || !data ? (
        <Loading />
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total sales" value={formatPrice(data.summary.totalSales)} />
            <Stat label="Transactions" value={String(data.summary.orderCount)} />
            <Stat label="Avg. ticket" value={formatPrice(data.summary.avgTicket)} />
          </div>

          <Card title="Sales by day">
            {data.byDay.length === 0 ? (
              <Empty />
            ) : (
              <div className="flex flex-col gap-1.5">
                {data.byDay.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 text-ink-muted">{d.date}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-sand">
                      <div
                        className="h-full rounded-full bg-clay-400"
                        style={{
                          width: `${(parseFloat(d.total) / maxDay) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-medium text-ink">
                      {formatPrice(d.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Payment methods">
              {data.paymentBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Method</TH>
                      <TH className="text-right">Count</TH>
                      <TH className="text-right">Total</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {data.paymentBreakdown.map((p) => (
                      <TR key={p.method}>
                        <TD>{METHOD_LABEL[p.method] ?? p.method}</TD>
                        <TD className="text-right">{p.count}</TD>
                        <TD className="text-right font-medium text-ink">
                          {formatPrice(p.total)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card title="Sales by category">
              {data.byCategory.length === 0 ? (
                <Empty />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Category</TH>
                      <TH className="text-right">Qty</TH>
                      <TH className="text-right">Total</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {data.byCategory.map((c) => (
                      <TR key={c.name}>
                        <TD>{c.name}</TD>
                        <TD className="text-right">{c.qty}</TD>
                        <TD className="text-right font-medium text-ink">
                          {formatPrice(c.total)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>

          <Card title="Top items">
            {data.topItems.length === 0 ? (
              <Empty />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH className="text-right">Qty sold</TH>
                    <TH className="text-right">Revenue</TH>
                  </TR>
                </THead>
                <tbody>
                  {data.topItems.map((it) => (
                    <TR key={it.name}>
                      <TD className="font-medium text-ink">{it.name}</TD>
                      <TD className="text-right">{it.qty}</TD>
                      <TD className="text-right">{formatPrice(it.total)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-ink-muted">No data in this range.</p>;
}
