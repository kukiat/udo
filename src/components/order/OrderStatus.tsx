import { PillButton } from "@/components/ui/PillButton";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/utils";
import type { OrderDTO, OrderStatus as Status } from "@/types";

// Marrow customer-side stages (cancelled/completed get their own treatment).
const STAGES: { id: Status; label: string; blurb: string }[] = [
  { id: "pending", label: "Received", blurb: "Sent to the kitchen" },
  { id: "preparing", label: "Preparing", blurb: "Chefs are on it" },
  { id: "ready", label: "Ready", blurb: "Server will bring it out" },
];

const labels: Record<Status, string> = {
  pending: "Received",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function OrderStatusCard({
  order,
  onCancel,
  cancelling = false,
}: {
  order: OrderDTO;
  onCancel?: (order: OrderDTO) => void;
  cancelling?: boolean;
}) {
  const cancelled = order.status === "cancelled";
  const served = order.status === "served" || order.status === "completed";
  const stageIdx = Math.max(
    0,
    STAGES.findIndex((s) => s.id === order.status),
  );
  const placedAt = new Date(order.createdAt);
  const time = placedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Order
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[20px] font-semibold tracking-tight text-ink">
              {order.orderNumber}
            </span>
            <span className="mono text-[11px] text-ink-dim">{time}</span>
          </div>
        </div>
        <StatusPill status={order.status} />
      </div>

      {cancelled && order.cancelReason && (
        <p className="mt-3 rounded-sm bg-rose-soft px-3 py-2 text-xs text-rose">
          <span className="font-semibold">Cancelled:</span> {order.cancelReason}
        </p>
      )}

      {/* Marrow stage tracker — only while order is in motion */}
      {!cancelled && !served && (
        <div className="mt-5 flex gap-0">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const current = i === stageIdx;
            return (
              <div
                key={s.id}
                className="relative flex flex-1 flex-col items-center text-center"
              >
                {/* Connector */}
                {i > 0 && (
                  <div
                    className={cn(
                      "absolute right-[calc(50%+18px)] left-[calc(-50%+18px)] top-[14px] h-0.5 transition-colors",
                      done || current ? "bg-clay-500" : "bg-line",
                    )}
                  />
                )}
                {/* Circle */}
                <div
                  className={cn(
                    "relative z-[1] grid h-[30px] w-[30px] place-items-center rounded-full border-2 transition-colors",
                    done
                      ? "border-clay-500 bg-clay-500 text-white"
                      : current
                        ? "animate-pulse-ring border-clay-500 bg-[var(--accent-soft)] text-clay-500"
                        : "border-line-strong bg-[var(--bg-sunken)] text-ink-dim",
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="m3 8 3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-[11px] font-semibold tabular-nums">{i + 1}</span>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-3 text-[12.5px] font-semibold",
                    done || current ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {s.label}
                </div>
                <div className="mt-0.5 max-w-[120px] text-[10.5px] text-ink-muted">
                  {s.blurb}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Items */}
      <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-2">
            <span className="min-w-0">
              <span className="mono mr-1.5 tabular-nums text-ink-muted">
                {it.quantity}×
              </span>
              <span className="text-ink">{it.name}</span>
              {it.options.length > 0 && (
                <span className="text-ink-muted">
                  {" · "}
                  {it.options.map((o) => o.name).join(", ")}
                </span>
              )}
            </span>
            <span className="mono shrink-0 tabular-nums text-ink-muted">
              {formatPrice(it.unitPrice)}
            </span>
          </li>
        ))}
      </ul>

      {/* Total */}
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-sm mb-3">
        <span className="font-semibold text-ink">Total</span>
        <span className="mono text-[16px] font-semibold tabular-nums">
          {formatPrice(order.totalAmount)}
        </span>
      </div>

      {onCancel && order.status === "pending" && (
        <PillButton
        className="w-full"
          tone="danger"
          variant="outline"
          isDisabled={cancelling}
          onPress={() => onCancel(order)}
        >
          {cancelling ? "Cancelling..." : "Cancel order"}
        </PillButton>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const palette: Record<Status, { pill: string; dot: string; pulse?: boolean }> = {
    pending: {
      pill: "border-[color:var(--accent)] bg-clay-100 text-clay-500",
      dot: "bg-clay-500",
      pulse: true,
    },
    preparing: {
      pill: "border-[color:var(--amber)] bg-amber-soft text-amber",
      dot: "bg-amber",
      pulse: true,
    },
    ready: {
      pill: "border-[color:var(--olive)] bg-olive-soft text-olive",
      dot: "bg-olive",
      pulse: true,
    },
    served: {
      pill: "border-[color:var(--blue)] bg-[var(--blue-soft)] text-[color:var(--blue)]",
      dot: "bg-[var(--blue)]",
    },
    completed: {
      pill: "border-line bg-sand text-ink-muted",
      dot: "bg-ink-dim",
    },
    cancelled: {
      pill: "border-[color:var(--rose)] bg-rose-soft text-rose",
      dot: "bg-rose",
    },
  };
  const p = palette[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        p.pill,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          p.dot,
          p.pulse && "animate-marrow-blink",
        )}
      />
      {labels[status]}
    </span>
  );
}
