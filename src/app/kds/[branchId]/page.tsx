"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const ALERT_MS = 10 * 60 * 1000;
const CRITICAL_MS = 15 * 60 * 1000;

// Marrow lane definitions — map onto the existing OrderStatus values.
const LANES: {
  status: OrderStatus;
  label: string;
  hint: string;
  accent: string;
  icon: string; // single-character glyph
}[] = [
  {
    status: "pending",
    label: "Incoming",
    hint: "Fired, not yet started",
    accent: "var(--ink-3)",
    icon: "◔",
  },
  {
    status: "preparing",
    label: "Cooking",
    hint: "In progress",
    accent: "var(--accent)",
    icon: "🔥",
  },
  {
    status: "ready",
    label: "Ready",
    hint: "Awaiting pickup",
    accent: "#7AA56F",
    icon: "✓",
  },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: "pending",
  ready: "preparing",
};

const BOARD_LANE_STATUSES = new Set<OrderStatus>(LANES.map((l) => l.status));
const EMPTY_DONE: Set<string> = new Set();

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

  const [done, setDone] = useState<Record<string, Set<string>>>({});
  const toggleItem = useCallback((orderId: string, itemId: string) => {
    setDone((prev) => {
      const set = new Set(prev[orderId]);
      set.has(itemId) ? set.delete(itemId) : set.add(itemId);
      return { ...prev, [orderId]: set };
    });
  }, []);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<OrderStatus | null>(null);

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
  const [pulse, setPulse] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = localStorage.getItem("rms.kds.theme");
      return stored === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("kds-theme", "kds-dark");
    else root.classList.remove("kds-theme", "kds-dark");
    return () => {
      root.classList.remove("kds-theme", "kds-dark");
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem("rms.kds.theme", next);
      } catch {}
      return next;
    });
  }, []);

  const joinAt = useRef<number>(0);
  const lastNewCount = useRef(0);

  // Normalize URL station if it points at an unknown id.
  useEffect(() => {
    if (rawStation !== "all" && stations.length > 0 && rawStation !== station) {
      setStation("all");
    }
  }, [rawStation, station, stations.length, setStation]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pulse "Active" counter when a brand-new ticket arrives.
  useEffect(() => {
    const count = orders.filter((o) => o.status === "pending").length;
    if (count > lastNewCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1400);
      lastNewCount.current = count;
      return () => clearTimeout(t);
    }
    lastNewCount.current = count;
  }, [orders]);

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

  const isReady = useCallback(
    (o: OrderDTO) => {
      const items = stationId
        ? o.items.filter((i) => i.kdsStationId === stationId)
        : o.items;
      const set = done[o.id];
      return items.length > 0 && !!set && items.every((i) => set.has(i.id));
    },
    [done, stationId],
  );

  const dragOrder = dragId ? orders.find((o) => o.id === dragId) : undefined;
  const canDropInto = useCallback(
    (laneStatus: OrderStatus) => {
      if (!dragOrder) return false;
      if (NEXT_STATUS[dragOrder.status] === laneStatus) return isReady(dragOrder);
      if (PREV_STATUS[dragOrder.status] === laneStatus) return true;
      return false;
    },
    [dragOrder, isReady],
  );

  const handleDrop = (laneStatus: OrderStatus) => {
    setOverLane(null);
    const o = dragId ? orders.find((x) => x.id === dragId) : undefined;
    setDragId(null);
    if (!o) return;
    const forward = NEXT_STATUS[o.status] === laneStatus && isReady(o);
    const backward = PREV_STATUS[o.status] === laneStatus;
    if (forward || backward) {
      setDone((prev) => {
        if (!prev[o.id]) return prev;
        const { [o.id]: _, ...rest } = prev;
        return rest;
      });
      bump(o, laneStatus);
    }
  };

  // Live counters — Marrow header strip.
  const activeCount = orders.length;
  const longestMs = orders.reduce(
    (max, o) => Math.max(max, now - new Date(o.createdAt).getTime()),
    0,
  );
  const longestTone =
    longestMs >= CRITICAL_MS
      ? "rose"
      : longestMs >= ALERT_MS
        ? "amber"
        : "ink";
  const avg = orders.length
    ? mmss(
        orders.reduce(
          (sum, o) => sum + (now - new Date(o.createdAt).getTime()),
          0,
        ) / orders.length,
      )
    : "0:00";

  if (rejected) {
    return (
      <div
        suppressHydrationWarning
        className={cn(
          "kds-theme flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center",
          theme === "dark" && "kds-dark",
        )}
      >
        <div
          style={{
            padding: 32,
            border: "1px solid var(--rose)",
            background: "var(--rose-soft)",
            borderRadius: "var(--radius-lg)",
            maxWidth: 420,
          }}
        >
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--rose)",
            }}
          >
            Connection rejected
          </h1>
          <p
            style={{
              marginTop: 8,
              color: "var(--ink-2)",
              fontSize: 13,
            }}
          >
            {rejected}
          </p>
          <button
            onClick={() => location.reload()}
            style={{
              marginTop: 20,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line-strong)",
              background: "var(--bg-elev)",
              color: "var(--ink)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        suppressHydrationWarning
        className={cn(
          "kds-theme flex min-h-screen items-center justify-center",
          theme === "dark" && "kds-dark",
        )}
        style={{ background: "var(--bg)", color: "var(--ink)" }}
      >
        <Loading label="Loading orders…" />
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "kds-theme flex min-h-screen flex-col",
        theme === "dark" && "kds-dark",
      )}
    >
      {/* ============ Header ============ */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between"
        style={{
          height: 64,
          paddingInline: 20,
          background: "#15171C",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="flex items-center gap-4">
          <BrandMark />
          <div style={{ width: 1, height: 24, background: "var(--line)" }} />
          <div className="flex items-baseline gap-3">
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Kitchen Display
            </span>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-4)" }}
            >
              {branchInfo?.restaurant.name ?? "—"} · {branchInfo?.name ?? ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <KdsCounter
            label="Active"
            value={String(activeCount)}
            tone={pulse ? "accent" : "ink"}
            pulse={pulse}
          />
          <KdsCounter
            label="Longest"
            value={mmss(longestMs)}
            tone={longestTone}
            mono
          />
          <KdsCounter label="Avg" value={avg} mono />
          <KdsCounter label="Served" value={String(serviced)} tone="olive" />
          <div style={{ width: 1, height: 28, background: "var(--line)", margin: "0 6px" }} />
          <Pill
            connected={connected}
            count={screen?.count}
            max={screen?.max}
            latency={latency}
          />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <AccountMenu />
        </div>
      </div>

      {/* ============ Station strip + legend ============ */}
      <div
        className="flex items-center gap-2 flex-wrap"
        style={{
          padding: "12px 20px",
          background: "var(--bg-sunken)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-4)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginRight: 4,
          }}
        >
          Station
        </span>
        <StationPill
          name="All"
          count={activeCount}
          active={station === "all"}
          onClick={() => setStation("all")}
        />
        {stations.map((s) => {
          const st = stationStyle(s.name);
          return (
            <StationPill
              key={s.id}
              name={s.name}
              colorClass={st.dot}
              count={countForStation(s.id)}
              active={station === s.id}
              onClick={() => setStation(s.id)}
            />
          );
        })}
        <div className="flex-1" />
        <UrgencyLegend />
      </div>

      {error && (
        <div className="px-5 pt-4">
          <ErrorState message={error} />
        </div>
      )}

      {/* ============ Kanban ============ */}
      <main
        className="flex-1"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0,
          minHeight: 0,
        }}
      >
        {lanes.map((lane) => {
          const isDropTarget = canDropInto(lane.status);
          const isOver = overLane === lane.status;
          return (
            <section
              key={lane.status}
              onDragOver={(e) => {
                if (!isDropTarget) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (!isOver) setOverLane(lane.status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setOverLane((prev) => (prev === lane.status ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(lane.status);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid var(--line)",
                minWidth: 0,
                background: "var(--bg)",
              }}
            >
              {/* Lane header */}
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--bg-elev)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "var(--bg-sunken)",
                      color: lane.accent,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                    }}
                    aria-hidden
                  >
                    {lane.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: "var(--ink)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {lane.label}
                      <span
                        className="tnum"
                        style={{
                          fontSize: 11,
                          width: 20,
                          height: 20,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: "var(--bg-sunken)",
                          color: "var(--ink-2)",
                          fontWeight: 600,
                          lineHeight: 1,
                        }}
                      >
                        {lane.orders.length}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-3)",
                        marginTop: 2,
                      }}
                    >
                      {lane.hint}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lane cards */}
              <FlipList
                className={cn(
                  "flex-1 flex flex-col gap-3 transition-colors overflow-y-auto",
                  isOver && "bg-clay-500/5",
                )}
                style={{
                  padding: 14,
                  maxHeight: "calc(100vh - 64px - 53px)",
                  outline: isDropTarget
                    ? "2px dashed rgba(217,84,43,0.35)"
                    : undefined,
                  outlineOffset: -8,
                  borderRadius: 0,
                }}
              >
                {lane.orders.length === 0 ? (
                  <div
                    style={{
                      padding: 36,
                      textAlign: "center",
                      color: "var(--ink-4)",
                      border: "1px dashed var(--line)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                  >
                    {isOver ? "Drop to move here" : laneEmpty(lane.status)}
                  </div>
                ) : (
                  lane.orders.map((o) => {
                    const ready = isReady(o);
                    const canForward =
                      ready &&
                      !!NEXT_STATUS[o.status] &&
                      BOARD_LANE_STATUSES.has(NEXT_STATUS[o.status]!);
                    const canBackward = !!PREV_STATUS[o.status];
                    const canDrag = canForward || canBackward;
                    return (
                      <div
                        key={o.id}
                        data-flip-key={o.id}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          if (!canDrag) {
                            e.preventDefault();
                            return;
                          }
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(o.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverLane(null);
                        }}
                        className={cn(
                          canDrag && "cursor-grab active:cursor-grabbing",
                          dragId === o.id && "opacity-50",
                        )}
                      >
                        <KdsOrderCard
                          order={o}
                          now={now}
                          stationId={stationId}
                          stationsById={stationsById}
                          onBump={bump}
                          onCancel={setCancelTarget}
                          bumping={bumpingId === o.id}
                          done={done[o.id] ?? EMPTY_DONE}
                          onToggleItem={(itemId) => toggleItem(o.id, itemId)}
                        />
                      </div>
                    );
                  })
                )}
              </FlipList>
            </section>
          );
        })}
      </main>

      <CancelOrderDialog
        order={cancelTarget}
        cancelling={cancelling}
        onConfirm={confirmCancel}
        onDismiss={() => {
          if (!cancelling) setCancelTarget(null);
        }}
        theme={theme}
      />
    </div>
  );
}

function laneEmpty(status: OrderStatus): string {
  if (status === "pending") return "No new orders.";
  if (status === "preparing") return "Idle station.";
  return "Nothing waiting.";
}

// ============== Marrow header pieces ==============

function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Go to home"
      className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--ink)",
          position: "relative",
          display: "inline-block",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: "20%",
            background: "var(--accent)",
            borderRadius: "50%",
          }}
        />
      </span>
      <span
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        Marrow
      </span>
    </Link>
  );
}

function KdsCounter({
  label,
  value,
  tone = "ink",
  pulse,
  mono,
}: {
  label: string;
  value: string;
  tone?: "ink" | "accent" | "rose" | "amber" | "olive";
  pulse?: boolean;
  mono?: boolean;
}) {
  const palette: Record<string, { fg: string; bg: string }> = {
    ink: { fg: "var(--ink)", bg: "transparent" },
    accent: { fg: "var(--accent)", bg: "var(--accent-soft)" },
    rose: { fg: "var(--rose)", bg: "var(--rose-soft)" },
    amber: { fg: "var(--amber)", bg: "var(--amber-soft)" },
    olive: { fg: "var(--olive)", bg: "var(--olive-soft)" },
  };
  const p = palette[tone] ?? palette.ink;
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        background: p.bg,
        display: "flex",
        flexDirection: "column",
        minWidth: 76,
        animation: pulse ? "pulseRing 1.4s ease" : "none",
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "var(--ink-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? "mono" : "tnum"}
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: p.fg,
          letterSpacing: "-0.01em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({
  connected,
  count,
  max,
  latency,
}: {
  connected: boolean;
  count?: number;
  max?: number;
  latency: number | null;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid",
        borderColor: connected ? "var(--olive)" : "var(--line-strong)",
        background: connected ? "var(--olive-soft)" : "var(--bg-sunken)",
        color: connected ? "var(--olive)" : "var(--ink-3)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
      title={count != null && max != null ? `Screen ${count} of ${max}` : undefined}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: connected ? "var(--olive)" : "var(--ink-3)",
          animation: connected ? "blink 1.6s infinite" : "none",
        }}
      />
      {connected ? "Live" : "Offline"}
      {connected && latency != null && (
        <span
          className="mono"
          style={{ color: "var(--olive)", opacity: 0.7, letterSpacing: 0 }}
        >
          {latency}ms
        </span>
      )}
    </span>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const nextLabel = theme === "light" ? "Dark" : "Light";
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Switch to ${nextLabel} theme`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid transparent",
        background: "transparent",
        color: "var(--ink-2)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-sunken)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
        {theme === "light" ? "◐" : "○"}
      </span>
      {nextLabel}
    </button>
  );
}

function StationPill({
  name,
  count,
  colorClass,
  active,
  onClick,
}: {
  name: string;
  count: number | null;
  colorClass?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: active ? "var(--bg-elev)" : "transparent",
        border: "1px solid",
        borderColor: active ? "var(--line-strong)" : "transparent",
        borderRadius: 999,
        cursor: "pointer",
        color: "var(--ink-2)",
        fontSize: 12,
        fontWeight: 500,
        transition: "all 0.15s ease",
      }}
    >
      {colorClass && (
        <span
          className={colorClass}
          style={{ width: 8, height: 8, borderRadius: 999 }}
        />
      )}
      {name}
      {count != null && (
        <span
          className="tnum"
          style={{
            fontSize: 11,
            color: count > 0 ? "var(--ink)" : "var(--ink-4)",
            fontWeight: 600,
            width: 20,
            height: 20,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: count > 0 ? "var(--bg-sunken)" : "transparent",
            borderRadius: "50%",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function UrgencyLegend() {
  const swatches = [
    { color: "#7AA56F", label: "<5m" },
    { color: "#C98A14", label: "5–10m" },
    { color: "#D9542B", label: "10m+" },
    { color: "#B83A3A", label: "15m+", blink: true },
  ];
  return (
    <div
      className="flex items-center gap-3"
      style={{
        fontSize: 10,
        color: "var(--ink-4)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {swatches.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: s.color,
              animation: s.blink ? "blink 1s infinite" : "none",
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ============== FLIP animation list (unchanged) ==============

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function FlipList({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<string, number>>(new Map());

  useIsoLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const nodes = Array.from(container.children).filter(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && !!n.dataset.flipKey,
    );

    for (const node of nodes) {
      const key = node.dataset.flipKey!;
      const next = node.offsetTop;
      const last = prev.current.get(key);
      if (last !== undefined) {
        const dy = last - next;
        if (dy) {
          node.animate(
            [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
            { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
          );
        }
      } else {
        node.animate(
          [
            { transform: "translateY(-18px)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ],
          { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
    }

    prev.current = new Map(
      nodes.map((n) => [n.dataset.flipKey!, n.offsetTop]),
    );
  });

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
