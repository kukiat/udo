"use client";

import { useCallback, useEffect, useState } from "react";

import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { ErrorState, Loading } from "@/components/ui/States";
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

const METHOD: Record<string, { th: string; en: string; color: string }> = {
  qr: { th: "พร้อมเพย์ / QR", en: "PromptPay", color: "lime" },
  cash: { th: "เงินสด", en: "Cash", color: "butter" },
  card: { th: "บัตร", en: "Card", color: "coral" },
};

const CAT_HUES = [32, 18, 50, 95, 65, 110, 200, 300];

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
  const payTotal = data
    ? data.paymentBreakdown.reduce((s, p) => s + parseFloat(p.total), 0)
    : 0;
  const catTotal = data
    ? data.byCategory.reduce((s, c) => s + parseFloat(c.total), 0)
    : 0;

  return (
    <div className="max-w-5xl">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="h-display" style={{ fontSize: 44 }}>
            รายงานยอดขาย
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            SALES REPORTS · {branchName ?? "—"}
          </div>
        </div>
        <DateRangePicker
          label="ช่วงเวลา · DATE RANGE"
          value={{ from, to }}
          max={todayISO()}
          onChange={(r) => {
            setFrom(r.from);
            setTo(r.to);
          }}
        />
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
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 18 }}>
            <div
              className="stat"
              style={{
                background: "linear-gradient(135deg, oklch(0.3 0.1 130) 0%, var(--surface) 100%)",
                borderColor: "var(--lime)",
              }}
            >
              <div className="eyebrow">
                ยอดขายรวม <span style={{ opacity: 0.6 }}>· TOTAL SALES</span>
              </div>
              <div className="num mono" style={{ color: "var(--lime)" }}>
                {formatPrice(data.summary.totalSales)}
              </div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                รายการขาย <span style={{ opacity: 0.6 }}>· TRANSACTIONS</span>
              </div>
              <div className="num mono">{data.summary.orderCount}</div>
            </div>
            <div className="stat">
              <div className="eyebrow">
                เฉลี่ย/บิล <span style={{ opacity: 0.6 }}>· AVG TICKET</span>
              </div>
              <div className="num mono">{formatPrice(data.summary.avgTicket)}</div>
            </div>
          </div>

          {/* Sales by day */}
          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="h-2">ยอดขายรายวัน</div>
              <div className="eyebrow">SALES BY DAY</div>
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

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Payment methods */}
            <div className="card" style={{ padding: 22 }}>
              <div className="h-2" style={{ marginBottom: 4 }}>วิธีชำระ</div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>PAYMENT METHODS</div>
              {data.paymentBreakdown.length === 0 ? (
                <Empty />
              ) : (
                data.paymentBreakdown.map((p) => {
                  const m = METHOD[p.method] ?? { th: p.method, en: p.method, color: "sky" };
                  const pct = payTotal ? Math.round((parseFloat(p.total) / payTotal) * 100) : 0;
                  return (
                    <div key={p.method} style={{ marginBottom: 14 }}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 13 }}>
                          {m.th} <span style={{ color: "var(--text-3)", fontSize: 11 }}>· {m.en}</span>
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
              <div className="h-2" style={{ marginBottom: 4 }}>ยอดขายตามหมวด</div>
              <div className="eyebrow" style={{ marginBottom: 18 }}>SALES BY CATEGORY</div>
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

          {/* Top items */}
          <div className="card" style={{ padding: 22, marginTop: 18 }}>
            <div className="h-2" style={{ marginBottom: 4 }}>เมนูขายดี</div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>TOP ITEMS</div>
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
                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>{it.qty} จาน · sold</div>
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
  );
}

function Empty() {
  return (
    <p style={{ fontSize: 13, color: "var(--text-3)" }}>
      ไม่มีข้อมูลในช่วงนี้ · No data in this range.
    </p>
  );
}
