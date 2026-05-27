"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type { OrderDTO, OrderItemDTO, OrderStatus } from "@/types";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

// Time tiers (minutes): fresh < 7, warn < 12, urgent >= 12.
const WARN_MS = 7 * 60 * 1000;
const URGENT_MS = 12 * 60 * 1000;

type Tier = "fresh" | "warn" | "urgent";

const TIER: Record<
  Tier,
  { bar: string; head: string; timer: string; ring: string }
> = {
  fresh: {
    bar: "bg-green-500",
    head: "bg-green-50/70",
    timer: "text-green-700",
    ring: "border-green-200",
  },
  warn: {
    bar: "bg-amber-500",
    head: "bg-amber-50/70",
    timer: "text-amber-700",
    ring: "border-amber-300",
  },
  urgent: {
    bar: "bg-red-500",
    head: "bg-red-50",
    timer: "text-red-600",
    ring: "border-red-300",
  },
};

// Map a station name to its accent colors (dot + tag pill).
export function stationStyle(name: string | undefined): {
  dot: string;
  tag: string;
} {
  const n = (name ?? "").toUpperCase();
  if (n.includes("GRILL")) return { dot: "bg-red-500", tag: "bg-red-50 text-red-700" };
  if (n.includes("FRY")) return { dot: "bg-amber-500", tag: "bg-amber-50 text-amber-700" };
  if (n.includes("COLD")) return { dot: "bg-teal-500", tag: "bg-teal-50 text-teal-700" };
  if (n.includes("PASS")) return { dot: "bg-purple-500", tag: "bg-purple-50 text-purple-700" };
  if (n.includes("HOT")) return { dot: "bg-orange-500", tag: "bg-orange-50 text-orange-700" };
  if (n.includes("DRINK") || n.includes("BAR"))
    return { dot: "bg-blue-500", tag: "bg-blue-50 text-blue-700" };
  return { dot: "bg-clay-500", tag: "bg-clay-50 text-clay-700" };
}

function tierOf(createdAt: string, now: number): Tier {
  const ms = now - new Date(createdAt).getTime();
  if (ms >= URGENT_MS) return "urgent";
  if (ms >= WARN_MS) return "warn";
  return "fresh";
}

function elapsed(createdAt: string, now: number): string {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

type Section = { name: string; items: OrderItemDTO[]; qty: number };

export function KdsOrderCard({
  order,
  now,
  stationId,
  stationsById,
  onBump,
  onCancel,
  bumping,
  done,
  onToggleItem,
}: {
  order: OrderDTO;
  now: number;
  stationId: string | null; // null = all
  stationsById: Map<string, string>;
  onBump: (order: OrderDTO, next: OrderStatus) => void;
  onCancel: (order: OrderDTO) => void;
  bumping: boolean;
  // "Checked off" line items (prep tracking), lifted to the board so it can
  // gate drag-and-drop / bumping.
  done: Set<string>;
  onToggleItem: (itemId: string) => void;
}) {
  const toggle = onToggleItem;

  const items = stationId
    ? order.items.filter((i) => i.kdsStationId === stationId)
    : order.items;

  // Group items into course sections (by menu category), preserving order.
  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, Section>();
    for (const it of items) {
      const key = it.category ?? "Other";
      const sec = map.get(key) ?? { name: key, items: [], qty: 0 };
      sec.items.push(it);
      sec.qty += it.quantity;
      map.set(key, sec);
    }
    return [...map.values()];
  }, [items]);

  const tier = tierOf(order.createdAt, now);
  const t = TIER[tier];
  const next = NEXT[order.status];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border bg-white shadow-card",
        t.ring,
      )}
    >
      {/* Left time-accent stripe */}
      <span className={cn("absolute inset-y-0 left-0 w-1.5", t.bar)} />

      {/* Header */}
      <div className={cn("px-4 pb-3 pt-3 pl-5", t.head)}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-extrabold tracking-tight text-ink">
              {order.orderNumber}
            </p>
            <p className="mt-0.5 flex flex-nowrap items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft">
              <span className="font-semibold">T{order.tableNumber}</span>
              <span className="text-ink-muted">·</span>
              <span>{totalQty} cvr</span>
              <span className="text-ink-muted">·</span>
              <span className="font-medium uppercase tracking-wide text-ink-muted">
                {order.type === "take_away" ? "Take-away" : "Dine-in"}
              </span>
            </p>
          </div>
          <div
            className={cn("font-mono text-2xl font-bold tabular-nums", t.timer)}
          >
            {elapsed(order.createdAt, now)}
          </div>
        </div>
      </div>

      {/* Course sections */}
      <div className="flex-1 px-4 pl-5">
        {sections.map((sec, si) => {
          const doneCount = sec.items.filter((i) => done.has(i.id)).length;
          const allDone = doneCount === sec.items.length;
          const noneDone = doneCount === 0;
          const status = allDone ? "READY" : noneDone ? "FIRE" : "IN PREP";
          const statusCls = allDone
            ? "bg-green-100 text-green-700"
            : noneDone
              ? "border border-red-300 text-red-600"
              : "bg-blue-50 text-blue-700";

          return (
            <div
              key={sec.name}
              className={cn(
                "py-3",
                si > 0 && "border-t border-dashed border-line",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {sec.name}{" "}
                  <span className="ml-0.5 text-ink-soft">{sec.qty}</span>
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    statusCls,
                  )}
                >
                  {status}
                </span>
              </div>

              <ul className="space-y-1.5">
                {sec.items.map((it) => {
                  const isDone = done.has(it.id);
                  const stationName = it.kdsStationId
                    ? stationsById.get(it.kdsStationId)
                    : undefined;
                  const st = stationStyle(stationName);
                  const mods = [
                    ...it.options.map((o) => o.name),
                    ...(it.note ? [it.note] : []),
                  ];
                  return (
                    <li key={it.id} className="flex items-start gap-2.5">
                      <button
                        onClick={() => toggle(it.id)}
                        aria-label={isDone ? "Mark not done" : "Mark done"}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-colors",
                          isDone
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-line bg-white text-ink-muted hover:border-ink-muted",
                        )}
                      >
                        {isDone ? "✓" : it.quantity}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium leading-tight",
                            isDone
                              ? "text-ink-muted line-through"
                              : noneDone
                                ? "text-ink-soft"
                                : "text-ink",
                          )}
                        >
                          {it.name}
                        </p>
                        {mods.length > 0 && (
                          <p className="text-xs italic text-ink-muted">
                            {mods.join(" · ")}
                          </p>
                        )}
                      </div>
                      {stationName && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                            st.tag,
                          )}
                        >
                          {stationName}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Cancel — revealed on hover, keeps the clean look */}
      {(order.status === "pending" || order.status === "preparing") && (
        <button
          onClick={() => onCancel(order)}
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full text-ink-muted opacity-0 transition hover:bg-white hover:text-red-600 group-hover:flex group-hover:opacity-100"
          aria-label="Cancel order"
          title="Cancel order"
        >
          ✕
        </button>
      )}

      {/* Bump — advances the order's status (pending → preparing → ready → served) */}
      {next && (
        <button
          onClick={() => onBump(order, next)}
          disabled={bumping}
          className="m-2 ml-5 flex items-center justify-center gap-1.5 rounded-lg bg-ink py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {next}
        </button>
      )}
    </div>
  );
}
