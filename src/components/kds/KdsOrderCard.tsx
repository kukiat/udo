"use client";

import { useMemo } from "react";

import { CloseButton } from "@/components/ui/CloseButton";
import { PillButton } from "@/components/ui/PillButton";
import { cn } from "@/lib/cn";
import type { OrderDTO, OrderItemDTO, OrderStatus } from "@/types";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

// Udo urgency tiers (minutes): ok <5, warn 5-10, alert 10-15, critical 15+.
const WARN_MS = 5 * 60 * 1000;
const ALERT_MS = 10 * 60 * 1000;
const CRITICAL_MS = 15 * 60 * 1000;

type Tier = "ok" | "warn" | "alert" | "critical";

const TIER: Record<
  Tier,
  {
    bar: string; // top urgency stripe (Udo color)
    border: string;
    bg: string;
    timerFg: string;
    timerBg: string;
    itemBorder: string;
    pulseBar?: boolean;
  }
> = {
  ok: {
    bar: "#7AA56F",
    border: "var(--line-strong)",
    bg: "var(--bg-elev)",
    timerFg: "#7AA56F",
    timerBg: "rgba(122,165,111,0.10)",
    itemBorder: "var(--kds-item-border-ok)",
  },
  warn: {
    bar: "#C98A14",
    border: "var(--tier-warn-border)",
    bg: "var(--tier-warn-bg)",
    timerFg: "#C98A14",
    timerBg: "rgba(201,138,20,0.14)",
    itemBorder: "var(--kds-item-border-warn)",
  },
  alert: {
    bar: "#D9542B",
    border: "var(--tier-alert-border)",
    bg: "var(--tier-alert-bg)",
    timerFg: "#D9542B",
    timerBg: "rgba(217,84,43,0.16)",
    itemBorder: "var(--kds-item-border-alert)",
  },
  critical: {
    bar: "#B83A3A",
    border: "var(--tier-critical-border)",
    bg: "var(--tier-critical-bg)",
    timerFg: "#B83A3A",
    timerBg: "rgba(184,58,58,0.18)",
    itemBorder: "var(--kds-item-border-critical)",
    pulseBar: true,
  },
};

const READY_TONE = {
  border: "var(--tier-ready-border)",
  bg: "var(--tier-ready-bg)",
  bar: "#7AA56F",
  itemBorder: "var(--kds-item-border-ready)",
};

// Udo station accents — keyed by name fragment.
function stationAccent(name: string | undefined): string {
  const n = (name ?? "").toUpperCase();
  if (n.includes("GRILL") || n.includes("HOT")) return "#D9542B";
  if (n.includes("FRY")) return "#C98A14";
  if (n.includes("COLD")) return "#2A6F4E";
  if (n.includes("PASS")) return "#9A6BB5";
  if (n.includes("DRINK") || n.includes("BAR")) return "#3B82C4";
  return "#9C9990";
}

// Back-compat export — still used by station tabs in the page header.
export function stationStyle(name: string | undefined): {
  dot: string;
  tag: string;
} {
  const n = (name ?? "").toUpperCase();
  if (n.includes("GRILL") || n.includes("HOT"))
    return { dot: "bg-clay-500", tag: "bg-clay-100 text-clay-700" };
  if (n.includes("FRY"))
    return { dot: "bg-amber", tag: "bg-amber-soft text-amber" };
  if (n.includes("COLD"))
    return { dot: "bg-olive", tag: "bg-olive-soft text-olive" };
  if (n.includes("PASS"))
    return { dot: "bg-purple-500", tag: "bg-purple-50 text-purple-700" };
  if (n.includes("DRINK") || n.includes("BAR"))
    return { dot: "bg-blue-500", tag: "bg-blue-50 text-blue-700" };
  return { dot: "bg-ink-muted", tag: "bg-sand text-ink-soft" };
}

function tierOf(createdAt: string, now: number, isReady: boolean): Tier {
  const ms = now - new Date(createdAt).getTime();
  if (isReady) return "ok"; // ready tickets stay calm
  if (ms >= CRITICAL_MS) return "critical";
  if (ms >= ALERT_MS) return "alert";
  if (ms >= WARN_MS) return "warn";
  return "ok";
}

function elapsed(createdAt: string, now: number): string {
  const ms = Math.max(0, now - new Date(createdAt).getTime());
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

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
  stationId: string | null;
  stationsById: Map<string, string>;
  onBump: (order: OrderDTO, next: OrderStatus) => void;
  onCancel: (order: OrderDTO) => void;
  bumping: boolean;
  done: Set<string>;
  onToggleItem: (itemId: string) => void;
}) {
  const items = stationId
    ? order.items.filter((i) => i.kdsStationId === stationId)
    : order.items;

  const hiddenItems = order.items.length - items.length;

  const totalQty = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items],
  );

  const isReadyLane = order.status === "ready";
  const tier = tierOf(order.createdAt, now, isReadyLane);
  const t = isReadyLane
    ? { ...TIER.ok, ...READY_TONE }
    : TIER[tier];
  const next = NEXT[order.status];

  if (items.length === 0) return null;

  // Primary action label/icon per lane
  let primaryLabel = "Bump · served";
  if (order.status === "pending") primaryLabel = "Start order";
  else if (order.status === "preparing") primaryLabel = "Mark ready";
  else if (order.status === "ready") primaryLabel = "Served";

  const canCancel = order.status === "pending" || order.status === "preparing";

  return (
    <div
      className="group relative flex flex-col overflow-hidden animate-slide-up"
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius)",
      }}
    >
      {/* Top urgency stripe */}
      <div
        style={{
          height: 3,
          background: t.bar,
          opacity: tier === "critical" ? 1 : 0.85,
          animation: tier === "critical" ? "blink 1s infinite" : "none",
        }}
      />

      {/* Header */}
      <div className="px-3.5 pt-3 pb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--ink-3)" }}
            >
              #{order.orderNumber}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              Table {order.tableNumber}
            </span>
            {order.type === "take_away" && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 999,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                }}
              >
                To-go
              </span>
            )}
          </div>
          <div
            className="flex gap-2 mt-1 flex-wrap"
            style={{ fontSize: 11, color: "var(--ink-3)" }}
          >
            <span>
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <span>·</span>
            <span>{totalQty} cvr</span>
          </div>
        </div>
        <div
          className="mono"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            background: t.timerBg,
            color: t.timerFg,
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.02em",
            animation: tier === "critical" ? "blink 1.2s infinite" : "none",
            whiteSpace: "nowrap",
          }}
        >
          {elapsed(order.createdAt, now)}
        </div>
      </div>

      {/* Items */}
      <div className="px-3.5 pb-3 pt-1 flex-1">
        {items.map((it, idx) => {
          const isDone = done.has(it.id);
          const stationName = it.kdsStationId
            ? stationsById.get(it.kdsStationId)
            : undefined;
          const accent = stationAccent(stationName);
          const mods = [
            ...it.options.map((o) => o.name),
            ...(it.note ? [it.note] : []),
          ];
          return (
            <button
              key={it.id}
              onClick={() => onToggleItem(it.id)}
              className="w-full text-left transition-colors"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 10,
                padding: "8px 10px",
                marginTop: idx === 0 ? 4 : 4,
                background: isDone
                  ? "var(--kds-item-bg-done)"
                  : "var(--kds-item-bg)",
                border: `1px solid ${t.itemBorder}`,
                borderRadius: "var(--radius-sm)",
                color: "inherit",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDone
                  ? "var(--kds-item-bg-done-hover)"
                  : "var(--kds-item-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDone
                  ? "var(--kds-item-bg-done)"
                  : "var(--kds-item-bg)";
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: isDone
                    ? "var(--kds-item-done-icon-bg)"
                    : order.status === "preparing"
                      ? "rgba(217,84,43,0.15)"
                      : "var(--bg-sunken)",
                  color: isDone
                    ? "#3a6f4e"
                    : order.status === "preparing"
                      ? "var(--accent)"
                      : "var(--ink-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {isDone ? "✓" : it.quantity}
              </span>
              <div className="min-w-0">
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    color: isDone ? "var(--ink-3)" : "var(--ink)",
                    textDecoration: isDone ? "line-through" : "none",
                  }}
                >
                  <span
                    className="tnum"
                    style={{ marginRight: 6, color: "var(--ink-3)" }}
                  >
                    {it.quantity}×
                  </span>
                  {it.name}
                </div>
                {mods.length > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 3,
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>⚠</span>
                    <span>{mods.join(" · ")}</span>
                  </div>
                )}
              </div>
              {stationName && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "var(--kds-station-bg)",
                    color: accent,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    alignSelf: "flex-start",
                  }}
                >
                  {stationName}
                </span>
              )}
            </button>
          );
        })}
        {hiddenItems > 0 && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--ink-4)",
              textAlign: "center",
              padding: 6,
              border: "1px dashed var(--line)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            +{hiddenItems} more on other station
            {hiddenItems === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div
        style={{
          borderTop: `1px solid ${t.border}`,
          padding: 8,
          display: "flex",
          gap: 6,
          background: "var(--kds-footer-bg)",
        }}
      >
        {canCancel && (
          <CloseButton onPress={() => onCancel(order)} label="Cancel order" />
        )}
        {next && (
          <PillButton
            tone={order.status === "ready" ? "success" : "accent"}
            onPress={() => onBump(order, next)}
            isDisabled={bumping}
            className={cn(
              "!flex-1",
              order.status === "ready" &&
                "!border-[#7AA56F] !bg-[#7AA56F] hover:!border-[#6f9a64] hover:!bg-[#6f9a64] hover:!shadow-none",
            )}
          >
            {primaryLabel}
          </PillButton>
        )}
      </div>
    </div>
  );
}

// Re-export item type for callers that imported alongside.
export type { OrderItemDTO };
