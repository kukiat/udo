"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useDashboardTheme } from "@/components/dashboard/DashboardShell";
import { RestaurantFormModal } from "@/components/dashboard/RestaurantFormModal";
import { PillButton } from "@/components/ui/PillButton";
import { ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { formatPrice } from "@/lib/utils";

type SalesResponse = {
  summary: { totalSales: string; orderCount: number; avgTicket: string };
  billSummary: {
    activeOpen: number;
    activeRequested: number;
    activePaid: number;
    activeTotal: number;
    activeAmount: string;
    paidInRange: number;
  };
  byDay: { date: string; total: string }[];
  byCategory: { name: string; total: string; qty: number }[];
  topItems: { name: string; qty: number; total: string }[];
};

type BranchSalesRow = {
  branchId: string;
  name: string;
  total: string;
  paymentCount: number;
  paidBills: number;
  byDay: { date: string; total: string }[];
};

// Local-timezone date key (YYYY-MM-DD). Timestamps are stored in UTC; all
// day grouping in the UI happens in the viewer's local timezone.
function dayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function shortDay(iso: string) {
  // "Mon", "Tue" … — parse as local midnight (date-only strings parse as UTC)
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}
function shortDate(iso: string) {
  // "May 27"
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function markOf(name?: string | null): string {
  if (!name) return "R";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

function useAnimatedNumber(value: number, duration = 900) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);
  const displayValueRef = useRef(0);

  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value === previousValueRef.current
    ) {
      previousValueRef.current = value;
      displayValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    const startValue = displayValueRef.current;
    const change = value - startValue;
    let frame = 0;
    let startTime: number | null = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (time: number) => {
      startTime ??= time;
      const progress = Math.min((time - startTime) / duration, 1);
      const nextValue = startValue + change * easeOutCubic(progress);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = value;
      displayValueRef.current = value;
      setDisplayValue(value);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function AnimatedMoneyValue({ value }: { value: number }) {
  const displayValue = useAnimatedNumber(value);
  return <>{formatPrice(displayValue)}</>;
}

function AnimatedNumberValue({ value }: { value: number }) {
  const displayValue = useAnimatedNumber(value);
  return <>{Math.round(displayValue).toLocaleString("en-US")}</>;
}

function AnimatedCompactMoneyValue({ value }: { value: number }) {
  const displayValue = useAnimatedNumber(value, 700);
  return (
    <>
      {displayValue >= 1000
        ? `฿${(displayValue / 1000).toFixed(1)}k`
        : `฿${Math.round(displayValue)}`}
    </>
  );
}

// 4-up KPI tile. Mirrors the Stat primitive from the Udo design.
function Stat({
  label,
  value,
  delta,
  deltaTone = "olive",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaTone?: "olive" | "rose" | "neutral";
  sub?: React.ReactNode;
}) {
  const toneClass =
    deltaTone === "olive"
      ? "bg-olive-soft text-olive"
      : deltaTone === "rose"
        ? "bg-rose-soft text-rose"
        : "bg-sand text-ink-muted";
  const arrow = deltaTone === "rose" ? "▼" : "▲";
  return (
    <div className="min-w-0 rounded-card border border-line bg-white p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-2.5">
        <div
          className="tnum min-w-0 text-[30px] font-semibold text-ink transition-colors duration-300"
          style={{
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </div>
        {delta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-medium ${toneClass}`}
          >
            <span aria-hidden style={{ fontSize: 9 }}>
              {arrow}
            </span>
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

// 7-day revenue bar chart. Today's bar is filled with the accent, prior days
// dim to ink-muted.
function RevenueChart({
  days,
}: {
  days: { date: string; total: number }[];
}) {
  const max = Math.max(0.0001, ...days.map((d) => d.total)) * 1.1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[120px] flex-1 items-end gap-2 pt-4 pb-2">
        {days.map((d, i) => {
          const pct = (d.total / max) * 100;
          const isToday = i === days.length - 1;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <div
                className="tnum text-[11px] font-semibold"
                style={{
                  color: isToday ? "var(--accent)" : "var(--ink-3)",
                }}
              >
                <AnimatedCompactMoneyValue value={d.total} />
              </div>
              <div
                className="w-full transition-[height] duration-500"
                style={{
                  maxWidth: 56,
                  height: `${Math.max(1, pct)}%`,
                  minHeight: 2,
                  borderRadius: "4px 4px 0 0",
                  background: isToday
                    ? "linear-gradient(180deg, var(--accent) 0%, #B8451F 100%)"
                    : "linear-gradient(180deg, var(--ink-3) 0%, var(--ink-4) 100%)",
                  opacity: isToday ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-1">
        {days.map((d) => (
          <div key={d.date} className="flex-1 text-center">
            <div className="text-[11px] font-medium text-ink-muted">
              {shortDay(d.date)}
            </div>
            <div className="mono text-[10px] text-ink-dim">
              {shortDate(d.date)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Line colors for non-active branches. The branch selected in the sidebar
// always draws with the accent.
const BRANCH_LINE_COLORS = [
  "var(--olive)",
  "#5B7F95",
  "#B3833B",
  "#96678F",
  "#6B7280",
];

function compactMoney(v: number) {
  return v >= 1000 ? `฿${(v / 1000).toFixed(1)}k` : `฿${Math.round(v)}`;
}

// Branch comparison — one line per branch across the last 7 days. The
// branch selected in the sidebar is drawn with the accent on top.
function BranchSalesLineChart({
  rows,
  days,
  activeBranchId,
}: {
  rows: BranchSalesRow[];
  days: string[];
  activeBranchId: string | null;
}) {
  const W = 700;
  const H = 240;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 14;
  const PAD_B = 36;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  let palette = 0;
  const series = rows.map((r) => {
    const byDate = new Map(r.byDay.map((d) => [d.date, parseFloat(d.total)]));
    const isActive = r.branchId === activeBranchId;
    return {
      ...r,
      isActive,
      color: isActive
        ? "var(--accent)"
        : BRANCH_LINE_COLORS[palette++ % BRANCH_LINE_COLORS.length],
      values: days.map((d) => byDate.get(d) ?? 0),
    };
  });
  // Draw the active branch last so it sits on top of overlapping lines.
  const drawOrder = [...series].sort(
    (a, b) => Number(a.isActive) - Number(b.isActive),
  );

  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.1;
  const x = (i: number) =>
    PAD_L + (days.length <= 1 ? plotW / 2 : (i * plotW) / (days.length - 1));
  const y = (v: number) => PAD_T + (1 - v / max) * plotH;
  const grand = series.reduce((s, r) => s + parseFloat(r.total), 0);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Sales by branch, last 7 days"
        style={{ width: "100%", height: "auto" }}
      >
        {/* Horizontal gridlines + y labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = max * f;
          return (
            <g key={f}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth={1}
                strokeDasharray={f === 0 ? undefined : "3 4"}
              />
              <text
                x={PAD_L - 8}
                y={y(v) + 3.5}
                textAnchor="end"
                fontSize={10.5}
                fill="var(--ink-3)"
                className="tnum"
              >
                {compactMoney(v)}
              </text>
            </g>
          );
        })}

        {/* Day labels */}
        {days.map((d, i) => (
          <g key={d}>
            <text
              x={x(i)}
              y={H - 18}
              textAnchor="middle"
              fontSize={11}
              fontWeight={500}
              fill="var(--ink-3)"
            >
              {shortDay(d)}
            </text>
            <text
              x={x(i)}
              y={H - 5}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--ink-4)"
            >
              {shortDate(d)}
            </text>
          </g>
        ))}

        {/* Lines */}
        {drawOrder.map((s) => (
          <g key={s.branchId}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.isActive ? 2.5 : 1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.isActive ? 1 : 0.75}
            />
            {s.values.map((v, i) => (
              <circle
                key={days[i]}
                cx={x(i)}
                cy={y(v)}
                r={s.isActive ? 3.5 : 2.75}
                fill="var(--bg-elev, #fff)"
                stroke={s.color}
                strokeWidth={s.isActive ? 2 : 1.5}
                opacity={s.isActive ? 1 : 0.85}
              >
                <title>{`${s.name} · ${shortDate(days[i])}: ${formatPrice(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3">
        {series.map((s) => {
          const total = parseFloat(s.total);
          const share = grand > 0 ? Math.round((total / grand) * 100) : 0;
          return (
            <div key={s.branchId} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span
                className="text-[12px] font-medium"
                style={{ color: s.isActive ? "var(--ink)" : "var(--ink-2)" }}
              >
                {s.name}
              </span>
              {s.isActive && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-clay-100 px-1.5 py-px text-[9px] font-semibold text-clay-500">
                  Active
                </span>
              )}
              <span className="tnum text-[12px] font-semibold">
                <AnimatedMoneyValue value={total} />
              </span>
              <span className="tnum text-[11px] text-ink-muted">
                {share}% · {s.paidBills} bill{s.paidBills === 1 ? "" : "s"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHead({
  overline,
  title,
  subtitle,
  action,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        {overline && (
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {overline}
          </div>
        )}
        <div
          className="text-[24px] font-semibold text-ink"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 text-[13px] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div
          className="text-[16px] font-semibold text-ink"
          style={{ letterSpacing: "-0.005em", lineHeight: 1.2 }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function RestaurantOverviewPage() {
  const {
    loading,
    error,
    restaurantId,
    restaurantName,
    restaurantLogo,
    branches,
    branchId,
    branchName,
    refresh,
  } = useRestaurant();
  usePageTitle(restaurantName ? `Overview — ${restaurantName}` : "Overview");
  const theme = useDashboardTheme();

  const [editOpen, setEditOpen] = useState(false);

  const [todaySales, setTodaySales] = useState<SalesResponse | null>(null);
  const [weekSales, setWeekSales] = useState<SalesResponse | null>(null);
  const [yesterdayTotal, setYesterdayTotal] = useState<number | null>(null);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [branchSales, setBranchSales] = useState<BranchSalesRow[] | null>(
    null,
  );

  useEffect(() => {
    if (!branchId) {
      setTodaySales(null);
      setWeekSales(null);
      setYesterdayTotal(null);
      return;
    }
    const today = dayKey(new Date());
    const yest = dayKey(daysAgo(1));
    const weekStart = dayKey(daysAgo(6));
    const tz = new Date().getTimezoneOffset();
    let alive = true;
    Promise.all([
      api<SalesResponse>(
        `/api/reports/sales?branchId=${branchId}&from=${today}&to=${today}&tz=${tz}`,
      ),
      api<SalesResponse>(
        `/api/reports/sales?branchId=${branchId}&from=${weekStart}&to=${today}&tz=${tz}`,
      ),
      api<SalesResponse>(
        `/api/reports/sales?branchId=${branchId}&from=${yest}&to=${yest}&tz=${tz}`,
      ),
    ])
      .then(([t, w, y]) => {
        if (!alive) return;
        setTodaySales(t);
        setWeekSales(w);
        setYesterdayTotal(parseFloat(y.summary.totalSales));
      })
      .catch(() => {
        if (alive) {
          setTodaySales(null);
          setWeekSales(null);
          setYesterdayTotal(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [branchId]);

  useEffect(() => {
    if (!restaurantId) {
      setBranchSales(null);
      return;
    }
    const today = dayKey(new Date());
    const weekStart = dayKey(daysAgo(6));
    const tz = new Date().getTimezoneOffset();
    let alive = true;
    api<{ branches: BranchSalesRow[] }>(
      `/api/reports/branch-sales?restaurantId=${restaurantId}&from=${weekStart}&to=${today}&tz=${tz}`,
    )
      .then((d) => alive && setBranchSales(d.branches))
      .catch(() => alive && setBranchSales(null));
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    api<{ items?: unknown[]; total?: number }>(
      `/api/menu?restaurantId=${restaurantId}`,
    )
      .then((d) => alive && setMenuCount(d.total ?? d.items?.length ?? 0))
      .catch(() => alive && setMenuCount(null));
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const openEdit = () => setEditOpen(true);

  // Today header — locale-formatted to mirror the design's "Today · Tue May 27 2026".
  const todayHeader = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `Today · ${fmt.format(new Date())}`;
  }, []);

  // Build a 7-day series that always renders 7 columns, filling in zeros for
  // days with no payments yet.
  const weekDays = useMemo(() => {
    const map = new Map<string, number>();
    (weekSales?.byDay ?? []).forEach((d) =>
      map.set(d.date, parseFloat(d.total)),
    );
    const out: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(daysAgo(i));
      out.push({ date: k, total: map.get(k) ?? 0 });
    }
    return out;
  }, [weekSales]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const todayRev = parseFloat(todaySales?.summary.totalSales ?? "0");
  const paidBillsToday =
    todaySales?.billSummary.paidInRange ?? todaySales?.summary.orderCount ?? 0;
  const requestedChecks = todaySales?.billSummary.activeRequested ?? 0;
  const openBills = todaySales?.billSummary.activeOpen ?? 0;
  const aov = parseFloat(todaySales?.summary.avgTicket ?? "0");
  const revDelta =
    yesterdayTotal && yesterdayTotal > 0
      ? ((todayRev - yesterdayTotal) / yesterdayTotal) * 100
      : null;
  const topItems = (todaySales?.topItems ?? []).slice(0, 6);
  const topMaxQty = topItems[0]?.qty ?? 1;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col">
      <SectionHead
        overline={todayHeader}
        title="Overview"
        subtitle={
          branchName
            ? `Real-time · ${branchName}`
            : "Real-time across all branches"
        }
        action={
          <div className="flex gap-2">
            <Link
              href={`/dashboard/${restaurantId}/reports`}
              className="inline-flex h-[34px] items-center gap-2 rounded-md border border-[color:var(--line-strong)] bg-[color:var(--bg-elev)] px-3.5 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--bg-sunken)]"
            >
              <span aria-hidden style={{ fontSize: 13 }}>
                ⌗
              </span>
              Reports
            </Link>
            <PillButton onPress={openEdit}>
              <span aria-hidden style={{ fontSize: 13 }}>
                ✎
              </span>
              Edit restaurant
            </PillButton>
          </div>
        }
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          label="Revenue, today"
          value={<AnimatedMoneyValue value={todayRev} />}
          delta={
            revDelta == null
              ? undefined
              : `${revDelta >= 0 ? "+" : ""}${revDelta.toFixed(1)}%`
          }
          deltaTone={revDelta == null ? "neutral" : revDelta >= 0 ? "olive" : "rose"}
          sub={
            yesterdayTotal != null
              ? (
                  <>
                    vs <AnimatedMoneyValue value={yesterdayTotal} /> yesterday
                  </>
                )
              : "No payments yet today"
          }
        />
        <Stat
          label="Paid bills"
          value={<AnimatedNumberValue value={paidBillsToday} />}
          sub="Completed payments today"
        />
        <Stat
          label="Requested checks"
          value={<AnimatedNumberValue value={requestedChecks} />}
          delta={requestedChecks > 0 ? "Needs attention" : undefined}
          deltaTone={requestedChecks > 0 ? "rose" : "neutral"}
          sub="Tables waiting to pay"
        />
        <Stat
          label="Open bills"
          value={<AnimatedNumberValue value={openBills} />}
          sub={
            <AnimatedMoneyValue
              value={parseFloat(todaySales?.billSummary.activeAmount ?? "0")}
            />
          }
        />
        <Stat
          label="Avg order value"
          value={<AnimatedMoneyValue value={aov} />}
          sub="Across paid orders"
        />
      </div>

      {/* Revenue chart + Top sellers */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-h-[250px] flex-col rounded-card border border-line bg-white p-4 lg:col-span-2">
          <CardHead
            title="Revenue, 7-day"
            subtitle={
              <AnimatedMoneyValue
                value={weekDays.reduce((s, d) => s + d.total, 0)}
              />
            }
            action={
              <div className="flex gap-1.5">
                <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-[3px] text-[11px] font-medium text-white">
                  Revenue
                </span>
                <span className="inline-flex items-center rounded-full border border-line-strong px-2.5 py-[3px] text-[11px] font-medium text-ink-soft">
                  Orders
                </span>
              </div>
            }
          />
          <RevenueChart days={weekDays} />
        </div>

        <div className="flex min-h-[250px] flex-col rounded-card border border-line bg-white p-4">
          <CardHead
            title="Top sellers, today"
            subtitle={
              <>
                <AnimatedNumberValue value={topItems.length} /> items · by qty
              </>
            }
            action={
              <Link
                href={`/dashboard/${restaurantId}/reports`}
                className="text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                Report →
              </Link>
            }
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {topItems.length === 0 && (
              <div className="py-6 text-center text-[12px] text-ink-muted">
                No sales yet today.
              </div>
            )}
            {topItems.map((row, i) => {
              const pct = (row.qty / topMaxQty) * 100;
              return (
                <div
                  key={row.name}
                  className="grid items-center gap-3 py-2.5"
                  style={{
                    gridTemplateColumns: "24px 1fr auto",
                    borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span
                    className="mono text-[11px] text-ink-dim"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="truncate text-[13px] font-medium"
                      style={{ letterSpacing: "-0.005em" }}
                    >
                      {row.name}
                    </div>
                    <div
                      className="mt-1.5 overflow-hidden rounded-full"
                      style={{
                        height: 4,
                        background: "var(--bg-sunken)",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background:
                            i < 3 ? "var(--accent)" : "var(--ink-3)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tnum text-[13px] font-semibold">
                      <AnimatedNumberValue value={row.qty} />
                    </div>
                    <div className="tnum text-[11px] text-ink-muted">
                      <AnimatedMoneyValue value={parseFloat(row.total)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Branch comparison */}
      {branchSales && branchSales.length > 0 && (
        <div className="mt-4 rounded-card border border-line bg-white p-4">
          <CardHead
            title="Sales by branch, 7-day"
            subtitle={
              <AnimatedMoneyValue
                value={branchSales.reduce(
                  (s, b) => s + parseFloat(b.total),
                  0,
                )}
              />
            }
            action={
              <Link
                href={`/dashboard/${restaurantId}/branches`}
                className="text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                Manage →
              </Link>
            }
          />
          {branchSales.every((b) => parseFloat(b.total) === 0) ? (
            <div className="py-6 text-center text-[12px] text-ink-muted">
              No payments in the last 7 days.
            </div>
          ) : (
            <BranchSalesLineChart
              rows={[...branchSales].sort(
                (a, b) => parseFloat(b.total) - parseFloat(a.total),
              )}
              days={weekDays.map((d) => d.date)}
              activeBranchId={branchId}
            />
          )}
        </div>
      )}

      {/* Branches + Brand */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col rounded-card border border-line bg-white p-4">
          <CardHead
            title="Branches"
            subtitle={
              <>
                <AnimatedNumberValue value={branches.length} /> total
              </>
            }
            action={
              <Link
                href={`/dashboard/${restaurantId}/branches`}
                className="text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                Manage →
              </Link>
            }
          />
          <div className="flex max-h-[360px] min-h-0 flex-col gap-2 overflow-y-auto pr-1">
            {branches.length === 0 && (
              <div className="py-6 text-center text-[12px] text-ink-muted">
                No branches yet.
              </div>
            )}
            {branches.map((b) => {
              const isActive = b.id === branchId;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-md px-3.5 py-3"
                  style={{ background: "var(--bg-sunken)" }}
                >
                  <div className="min-w-0">
                    <div
                      className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-semibold"
                      style={{ letterSpacing: "-0.005em" }}
                    >
                      <span className="min-w-0 truncate">{b.name}</span>
                      {isActive && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-clay-100 px-2 py-0.5 text-[10px] font-semibold text-clay-500">
                          <span className="h-1 w-1 rounded-full bg-clay-500" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {b.address ?? "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tnum text-[13px] font-semibold">
                      <AnimatedNumberValue
                        value={(b.settings?.vatRate ?? 0) * 100}
                      />
                      %
                    </div>
                    <div className="text-[11px] text-ink-muted">VAT</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-card border border-line bg-white p-4">
          <CardHead
            title="Brand"
            subtitle="Editable"
            action={
              <button
                onClick={openEdit}
                className="text-[12px] font-medium text-ink-soft hover:text-ink"
              >
                Edit →
              </button>
            }
          />
          <div
            className="flex items-center gap-4 rounded-card p-4"
            style={{ background: "var(--bg-sunken)" }}
          >
            {restaurantLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={restaurantLogo}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center text-clay-500"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  background: "var(--accent-soft)",
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {markOf(restaurantName)}
              </div>
            )}
            <div
              className="min-w-0 border-l pl-4"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <div
                className="truncate text-[18px] font-semibold"
                style={{ letterSpacing: "-0.02em" }}
              >
                {restaurantName ?? "—"}
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                Restaurant
              </div>
              <div className="mono mt-1 text-[11px] text-ink-dim">
                ฿ ·{" "}
                <AnimatedNumberValue value={branches.length} />{" "}
                {branches.length === 1 ? "branch" : "branches"}
                {menuCount != null && (
                  <>
                    {" "}
                    · <AnimatedNumberValue value={menuCount} /> item
                    {menuCount === 1 ? "" : "s"}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {restaurantId && (
        <RestaurantFormModal
          isOpen={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          restaurant={{
            id: restaurantId,
            name: restaurantName ?? "",
            logo: restaurantLogo ?? null,
          }}
          theme={theme}
          onSaved={async () => {
            await refresh();
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
