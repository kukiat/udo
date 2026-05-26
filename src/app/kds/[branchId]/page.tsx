"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { KdsOrderCard, stationStyle } from "@/components/kds/KdsOrderCard";
import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { AccountMenu } from "@/components/ui/AccountMenu";
import { ErrorState, Loading } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import type { OrderDTO, OrderStatus } from "@/types";

type Station = { id: string; name: string };
type StationsResponse = { stations: Station[] };
type OrdersResponse = { orders: OrderDTO[] };
type BranchResponse = {
  branch: {
    id: string;
    name: string;
    address: string | null;
    restaurant: { name: string };
  };
};

const URGENT_MS = 12 * 60 * 1000;
const PACES = ["calm", "busy", "rush"] as const;
type Pace = (typeof PACES)[number];

const LANES: {
  status: OrderStatus;
  label: string;
  hint: string;
  dot: string;
  head: string;
}[] = [
  {
    status: "pending",
    label: "New",
    hint: "Awaiting start",
    dot: "bg-slate-400",
    head: "border-slate-300",
  },
  {
    status: "preparing",
    label: "Preparing",
    hint: "On the line",
    dot: "bg-blue-500",
    head: "border-blue-300",
  },
  {
    status: "ready",
    label: "Ready",
    hint: "Pass / serve",
    dot: "bg-green-500",
    head: "border-green-300",
  },
];

function mmss(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function KdsPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const rawStation = searchParams.get("station") ?? "all";
  // Fall back to "all" if the URL points at a station that doesn't exist
  // (only once stations have loaded, so we don't clobber during fetch).
  const station =
    rawStation !== "all" &&
    stations.length > 0 &&
    !stations.some((s) => s.id === rawStation)
      ? "all"
      : rawStation;
  const setStation = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("station");
      else params.set("station", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const [now, setNow] = useState(() => Date.now());
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [branchInfo, setBranchInfo] = useState<BranchResponse["branch"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [screen, setScreen] = useState<{ count: number; max: number } | null>(
    null,
  );
  const [serviced, setServiced] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [pace, setPace] = useState<Pace>("busy");

  const joinAt = useRef<number>(0);

  // If the URL holds an unknown station, normalize it back to "all".
  useEffect(() => {
    if (rawStation !== "all" && stations.length > 0 && rawStation !== station) {
      setStation("all");
    }
  }, [rawStation, station, stations.length, setStation]);

  // Ticking clock for elapsed timers / overdue detection.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onNew = (order: OrderDTO) =>
      setOrders((prev) =>
        prev.some((o) => o.id === order.id) ? prev : [...prev, order],
      );
    const onUpdate = ({ order }: { order: OrderDTO }) =>
      setOrders((prev) => {
        if (
          order.status === "served" ||
          order.status === "completed" ||
          order.status === "cancelled"
        ) {
          if (order.status !== "cancelled" && prev.some((o) => o.id === order.id))
            setServiced((n) => n + 1);
          return prev.filter((o) => o.id !== order.id);
        }
        return prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [...prev, order];
      });
    const onReject = ({ reason }: { reason: string }) => {
      setRejected(reason);
      setLoading(false);
    };
    const onCount = (p: { count: number; max: number }) => {
      setScreen(p);
      if (joinAt.current && latency === null) {
        setLatency(Math.max(1, Math.round(performance.now() - joinAt.current)));
      }
    };

    socket.on("order:new", onNew);
    socket.on("order:status-update", onUpdate);
    socket.on("kds:reject", onReject);
    socket.on("kds:screen-count", onCount);

    const join = () => {
      setConnected(true);
      joinAt.current = performance.now();
      socket.emit("kds:join", { branchId });
    };
    const onDisconnect = () => setConnected(false);
    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);

    (async () => {
      try {
        const [s, o, b, served] = await Promise.all([
          api<StationsResponse>(`/api/kds-stations?branchId=${branchId}`),
          api<OrdersResponse>(`/api/orders?branchId=${branchId}&active=true`),
          api<BranchResponse>(`/api/branches/${branchId}`),
          api<OrdersResponse>(
            `/api/orders?branchId=${branchId}&statuses=served,completed`,
          ),
        ]);
        setStations(s.stations);
        setOrders(o.orders);
        setBranchInfo(b.branch);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        setServiced(
          served.orders.filter(
            (x) => new Date(x.createdAt).getTime() >= startOfDay.getTime(),
          ).length,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      socket.off("order:new", onNew);
      socket.off("order:status-update", onUpdate);
      socket.off("kds:reject", onReject);
      socket.off("kds:screen-count", onCount);
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const bump = async (order: OrderDTO, next: OrderStatus) => {
    setBumpingId(order.id);
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to bump order");
    } finally {
      setBumpingId(null);
    }
  };

  const confirmCancel = async (reason?: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason?.trim() || null }),
      });
      setCancelTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const stationsById = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations],
  );

  const stationId = station === "all" ? null : station;
  const countForStation = (id: string) =>
    orders.filter((o) => o.items.some((i) => i.kdsStationId === id)).length;

  // Orders matching the active station (any status) — drives status counts.
  const byStation = useMemo(
    () =>
      (stationId
        ? orders.filter((o) => o.items.some((i) => i.kdsStationId === stationId))
        : orders
      ).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [orders, stationId],
  );

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        orders: byStation.filter((o) => o.status === lane.status),
      })),
    [byStation],
  );

  // Stats (computed from the full active board).
  const avg = orders.length
    ? mmss(
        orders.reduce(
          (sum, o) => sum + (now - new Date(o.createdAt).getTime()),
          0,
        ) / orders.length,
      )
    : "0:00";
  const urgent = orders.filter(
    (o) =>
      o.status !== "ready" && now - new Date(o.createdAt).getTime() >= URGENT_MS,
  ).length;
  const readyToBump = orders.filter((o) => o.status === "ready").length;

  const clock = new Date(now);
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const date = clock
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", " ·")
    .toUpperCase();

  if (rejected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink p-8 text-center">
        <div className="rounded-card border border-red-300 bg-white px-8 py-10">
          <h1 className="text-2xl font-bold text-red-600">Connection rejected</h1>
          <p className="mt-2 max-w-sm text-ink-muted">{rejected}</p>
          <button
            onClick={() => location.reload()}
            className="mt-5 rounded-xl border border-line bg-white px-4 py-2 text-sm hover:bg-sand"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <Loading label="Loading orders…" />;

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      {/* ---------- Top bar ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-cream text-ink">
            ⌂
          </span>
          <div>
            <p className="text-sm font-bold text-ink">
              {branchInfo?.restaurant.name ?? "—"}{" "}
              <span className="text-ink-muted">/ {branchInfo?.name ?? ""}</span>
            </p>
            <p className="text-[11px] uppercase tracking-wide text-ink-muted">
              KDS · {branchInfo?.address ?? "Kitchen Display"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Stat value={String(orders.length)} label="Open" />
          <Stat value={avg} label="Avg time" />
          <Stat value={String(urgent)} label="Urgent" tone={urgent ? "red" : undefined} />
          <Stat value={String(readyToBump)} label="Ready to bump" />
          <Stat value={String(serviced)} label="Serviced · Tonight" />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex rounded-full border border-line bg-cream p-0.5 text-xs font-semibold">
            {PACES.map((p) => (
              <button
                key={p}
                onClick={() => setPace(p)}
                className={cn(
                  "rounded-full px-3 py-1 uppercase tracking-wide transition",
                  pace === p ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="text-right leading-none">
            <p className="font-mono text-lg font-bold tabular-nums text-ink">
              {time}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-ink-muted">
              {date}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              connected
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-line bg-cream text-ink-muted",
            )}
            title={screen ? `Screen ${screen.count} of ${screen.max}` : undefined}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "animate-pulse bg-green-500" : "bg-ink-muted",
              )}
            />
            {connected ? "LIVE" : "OFFLINE"}
            {connected && latency !== null && (
              <span className="font-normal text-green-600/70">{latency}ms</span>
            )}
          </span>
          <AccountMenu />
        </div>
      </header>

      {/* ---------- Station tabs ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStation("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
              station === "all"
                ? "bg-ink text-white"
                : "border border-line bg-white text-ink-soft hover:bg-sand",
            )}
          >
            All Stations
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px]",
                station === "all" ? "bg-white/20" : "bg-sand text-ink-muted",
              )}
            >
              {orders.length}
            </span>
          </button>
          {stations.map((s) => {
            const active = station === s.id;
            const st = stationStyle(s.name);
            return (
              <button
                key={s.id}
                onClick={() => setStation(s.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
                  active
                    ? "border-ink bg-ink/5 text-ink"
                    : "border-line bg-white text-ink-soft hover:bg-sand",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                {s.name}
                <span className="rounded-full bg-sand px-1.5 text-[11px] text-ink-muted">
                  {countForStation(s.id)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="px-5 pt-4">
          <ErrorState message={error} />
        </div>
      )}

      {/* ---------- Board (status lanes) ---------- */}
      <main className="flex flex-1 gap-4 overflow-x-auto px-5 py-5">
        {lanes.map((lane) => (
          <section
            key={lane.status}
            className="flex min-w-[320px] flex-1 flex-col rounded-card bg-white/50"
          >
            {/* Lane header */}
            <div
              className={cn(
                "sticky top-0 z-10 flex items-center justify-between rounded-t-card border-t-2 bg-white px-4 py-2.5",
                lane.head,
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", lane.dot)} />
                <p className="text-sm font-bold uppercase tracking-wide text-ink">
                  {lane.label}
                </p>
                <span className="text-[11px] text-ink-muted">{lane.hint}</span>
              </div>
              <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold tabular-nums text-ink-soft">
                {lane.orders.length}
              </span>
            </div>

            {/* Lane cards — 1 per row */}
            <div className="flex flex-1 flex-col gap-3 px-2 py-3">
              {lane.orders.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-card border border-dashed border-line py-16 text-center text-sm text-ink-muted">
                  No orders
                </div>
              ) : (
                lane.orders.map((o) => (
                  <KdsOrderCard
                    key={o.id}
                    order={o}
                    now={now}
                    stationId={stationId}
                    stationsById={stationsById}
                    onBump={bump}
                    onCancel={setCancelTarget}
                    bumping={bumpingId === o.id}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3">
        <div className="flex gap-2">
          {[
            { label: "Recall", icon: "↺" },
            { label: "Search", icon: "⌕" },
            { label: "Flag", icon: "⚑" },
            { label: "Transfer", icon: "⇄" },
          ].map((b) => (
            <button
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft hover:bg-sand"
            >
              <span aria-hidden>{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <Legend dot="bg-green-500" label="fresh < 7 m" />
          <Legend dot="bg-amber-500" label="warn < 12 m" />
          <Legend dot="bg-red-500" label="urgent ≥ 12 m" />
        </div>
      </footer>

      <CancelOrderDialog
        order={cancelTarget}
        cancelling={cancelling}
        onConfirm={confirmCancel}
        onDismiss={() => {
          if (!cancelling) setCancelTarget(null);
        }}
      />
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "red";
}) {
  return (
    <div className="text-center leading-none">
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "red" ? "text-red-600" : "text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}
