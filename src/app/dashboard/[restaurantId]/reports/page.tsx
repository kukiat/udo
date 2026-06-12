"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ReportsAgentChat } from "@/components/dashboard/ReportsAgentChat";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type SalesReport = {
  range: { from: string; to: string };
  summary: {
    totalSales: string;
    orderCount: number;
    avgTicket: string;
    subtotal: string;
    vat: string;
    serviceCharge: string;
    discount: string;
  };
  billSummary: {
    activeOpen: number;
    activeRequested: number;
    activePaid: number;
    activeTotal: number;
    activeAmount: string;
    paidInRange: number;
  };
  byDay: { date: string; total: string }[];
  paymentBreakdown: { method: string; total: string; count: number }[];
  cashierBreakdown: {
    cashierId: string | null;
    name: string;
    total: string;
    count: number;
  }[];
  shiftBreakdown: {
    shiftId: string | null;
    cashierName: string;
    status: string | null;
    openedAt: string | null;
    closedAt: string | null;
    total: string;
    count: number;
    cash: string;
    card: string;
    qr: string;
  }[];
  byCategory: { name: string; total: string; qty: number }[];
  topItems: { name: string; qty: number; total: string }[];
};

// Local-timezone date strings (YYYY-MM-DD) — timestamps are stored in UTC,
// but day boundaries follow the viewer's local timezone.
const localISO = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const todayISO = () => localISO(new Date());
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localISO(d);
};

const METHOD: Record<string, { label: string; color: string }> = {
  qr: { label: "PromptPay", color: "lime" },
  cash: { label: "Cash", color: "butter" },
  card: { label: "Card", color: "coral" },
};

const CAT_HUES = [32, 18, 50, 95, 65, 110, 200, 300];
const ENABLE_POS_SHIFT_WORKFLOW = false;

export default function ReportsPage() {
  const params = useParams();
  const restaurantId = String(params.restaurantId);
  const { branchId, branchName, loading: ctxLoading } = useRestaurant();
  usePageTitle(branchName ? `Reports — ${branchName}` : "Reports");
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    api<SalesReport>(
      `/api/reports/sales?branchId=${branchId}&from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`,
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
  const payTotal = data
    ? data.paymentBreakdown.reduce((s, p) => s + parseFloat(p.total), 0)
    : 0;
  const catTotal = data
    ? data.byCategory.reduce((s, c) => s + parseFloat(c.total), 0)
    : 0;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1 xl:max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            Sales Reports
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            SALES REPORTS - {branchName ?? "-"}
          </div>
        </div>
        <div className="row" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <DateRangePicker
            label="Date range"
            value={{ from, to }}
            max={todayISO()}
            onChange={(r) => {
              setFrom(r.from);
              setTo(r.to);
            }}
          />
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-pressed={chatOpen}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "9px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: chatOpen ? "var(--bg-elev)" : "var(--clay-500, var(--coral))",
              color: chatOpen ? "var(--text)" : "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {chatOpen ? "Hide chat" : "Ask agent"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState message={error} onRetry={load} />
        </div>
      )}

      {loading || !data ? (
        <Loading />
      ) : (
        <>
          {/* Big stats */}
          <div className="reports-stat-grid">
            <div
              className="stat reports-total-stat"
              style={{
                background: "linear-gradient(135deg, oklch(0.3 0.1 130) 0%, var(--surface) 100%)",
                borderColor: "var(--lime)",
              }}
            >
              <div className="eyebrow">
                Total sales
              </div>
              <div className="num mono reports-total-num" style={{ color: "var(--lime)" }}>
                {formatPrice(data.summary.totalSales)}
              </div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                Paid bills
              </div>
              <div className="num mono">{data.billSummary.paidInRange}</div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                Average ticket
              </div>
              <div className="num mono">{formatPrice(data.summary.avgTicket)}</div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                Discounts
              </div>
              <div className="num mono">{formatPrice(data.summary.discount)}</div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                VAT + service
              </div>
              <div className="num mono">
                {formatPrice(
                  parseFloat(data.summary.vat) +
                    parseFloat(data.summary.serviceCharge),
                )}
              </div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                Requested checks
              </div>
              <div className="num mono">{data.billSummary.activeRequested}</div>
            </div>
          </div>

          {/* Sales by day */}
          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="h-2">Sales by day</div>
              <div className="eyebrow">DAILY TOTALS</div>
            </div>
            {data.byDay.length === 0 ? (
              <Empty />
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {data.byDay.map((d, i) => {
                  const last = i === data.byDay.length - 1;
                  return (
                    <div key={d.date} className="row" style={{ gap: 12, fontSize: 13 }}>
                      <span className="mono" style={{ width: 90, color: "var(--text-3)", flexShrink: 0 }}>
                        {d.date.slice(5)}
                      </span>
                      <div style={{ flex: 1, height: 14, background: "var(--bg-elev)", borderRadius: 99, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            width: `${(parseFloat(d.total) / maxDay) * 100}%`,
                            background: last ? "var(--coral)" : "var(--coral-soft)",
                          }}
                        />
                      </div>
                      <span className="mono" style={{ width: 90, textAlign: "right", fontWeight: 700, flexShrink: 0 }}>
                        {formatPrice(d.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {/* Bill status */}
            <div className="card" style={{ padding: 22 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>Bill status</div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>ACTIVE TABLES NOW</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <MiniStat label="Open" value={data.billSummary.activeOpen} />
                <MiniStat label="Requested" value={data.billSummary.activeRequested} />
                <MiniStat label="Paid" value={data.billSummary.activePaid} />
              </div>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
                <span style={{ color: "var(--text-2)" }}>Active bill amount</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {formatPrice(data.billSummary.activeAmount)}
                </span>
              </div>
            </div>

            {/* Cashier totals */}
            <div className="card" style={{ padding: 22 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>Cashier totals</div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>PAYMENT OWNERSHIP</div>
              {data.cashierBreakdown.length === 0 ? (
                <Empty />
              ) : (
                data.cashierBreakdown.slice(0, 5).map((c, i) => (
                  <div
                    key={c.cashierId ?? c.name}
                    className="row"
                    style={{
                      gap: 12,
                      padding: "8px 0",
                      borderTop: i === 0 ? "none" : "1px dashed var(--border)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {c.count} payment{c.count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                      {formatPrice(c.total)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Payment methods */}
            <div className="card" style={{ padding: 22 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>Payment methods</div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>PAYMENT BREAKDOWN</div>
              {data.paymentBreakdown.length === 0 ? (
                <Empty />
              ) : (
                data.paymentBreakdown.map((p) => {
                  const m = METHOD[p.method] ?? { label: p.method, color: "sky" };
                  const pct = payTotal ? Math.round((parseFloat(p.total) / payTotal) * 100) : 0;
                  return (
                    <div key={p.method} style={{ marginBottom: 14 }}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13 }}>
                          {m.label}
                        </span>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: "var(--bg-elev)", borderRadius: 99 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: `var(--${m.color})`, borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sales by category */}
            <div className="card" style={{ padding: 22 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>Sales by category</div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>CATEGORY BREAKDOWN</div>
              {data.byCategory.length === 0 ? (
                <Empty />
              ) : (
                data.byCategory.map((c, i) => {
                  const pct = catTotal ? Math.round((parseFloat(c.total) / catTotal) * 100) : 0;
                  return (
                    <div key={c.name} style={{ marginBottom: 10 }}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{c.name}</span>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: "var(--bg-elev)", borderRadius: 99 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: `oklch(0.7 0.18 ${CAT_HUES[i % CAT_HUES.length]})`, borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {ENABLE_POS_SHIFT_WORKFLOW && (
            <div className="card" style={{ padding: 22, marginTop: 18 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>Shift payments</div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>CASHIER SHIFT TOTALS</div>
              {data.shiftBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <div className="col" style={{ gap: 0, minWidth: 620 }}>
                    {data.shiftBreakdown.slice(0, 8).map((s, i) => (
                      <div
                        key={s.shiftId ?? "no-shift"}
                        className="grid"
                        style={{
                          gridTemplateColumns: "minmax(120px, 1fr) repeat(4, minmax(74px, auto))",
                          gap: 12,
                          alignItems: "center",
                          padding: "10px 0",
                          borderTop: i === 0 ? "none" : "1px dashed var(--border)",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700 }}>{s.cashierName}</div>
                          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                            {s.status ?? "No shift"} - {s.count} payment{s.count === 1 ? "" : "s"}
                          </div>
                        </div>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {formatPrice(s.total)}
                        </span>
                        <span className="mono" style={{ color: "var(--text-2)" }}>
                          Cash {formatPrice(s.cash)}
                        </span>
                        <span className="mono" style={{ color: "var(--text-2)" }}>
                          Card {formatPrice(s.card)}
                        </span>
                        <span className="mono" style={{ color: "var(--text-2)" }}>
                          QR {formatPrice(s.qr)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top items */}
          <div className="card" style={{ padding: 22, marginTop: 18 }}>
            <div className="h-2" style={{ marginBottom: 4 }}>Top items</div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>BEST SELLERS</div>
            {data.topItems.length === 0 ? (
              <Empty />
            ) : (
              data.topItems.map((it, i) => (
                <div
                  key={it.name}
                  className="row"
                  style={{
                    gap: 12,
                    padding: "8px 0",
                    borderTop: i === 0 ? "none" : "1px dashed var(--border)",
                  }}
                >
                  <span className="mono" style={{ width: 24, color: "var(--text-3)", fontWeight: 700 }}>
                    {i + 1}.
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>{it.qty} sold</div>
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--lime)" }}>
                    {formatPrice(it.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
      </div>

      {chatOpen && (
        <aside className="w-full xl:min-w-[380px] xl:flex-1">
          <ReportsAgentChat
            restaurantId={restaurantId}
            branchName={branchName}
            range={{ from, to }}
            report={data}
            onClose={() => setChatOpen(false)}
          />
        </aside>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 10px",
        background: "var(--bg-elev)",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <p style={{ fontSize: 13, color: "var(--text-3)" }}>
      No data in this range.
    </p>
  );
}
