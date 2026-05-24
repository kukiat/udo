import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import type { OrderDTO, OrderStatus as Status } from "@/types";

const STEPS: Status[] = ["pending", "preparing", "ready", "served"];

const labels: Record<Status, string> = {
  pending: "Received",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

const tone: Record<
  Status,
  "neutral" | "amber" | "blue" | "green" | "clay" | "red"
> = {
  pending: "neutral",
  preparing: "amber",
  ready: "blue",
  served: "green",
  completed: "clay",
  cancelled: "red",
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
  const currentIdx = STEPS.indexOf(order.status);
  const cancelled = order.status === "cancelled";
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-ink">Order {order.orderNumber}</p>
          <p className="text-xs text-ink-muted">
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <Badge tone={tone[order.status]}>{labels[order.status]}</Badge>
      </div>

      {cancelled && order.cancelReason && (
        <p className="mt-2 text-xs text-red-600">
          Reason: {order.cancelReason}
        </p>
      )}

      {order.status !== "completed" && !cancelled && (
        <ol className="mt-3 flex items-center gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={
                  "h-1.5 w-full rounded-full " +
                  (i <= currentIdx ? "bg-clay-500" : "bg-line")
                }
              />
              <span
                className={
                  "text-[10px] " +
                  (i <= currentIdx ? "text-clay-700" : "text-ink-muted")
                }
              >
                {labels[s]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        {order.items.map((it) => (
          <li key={it.id} className="flex justify-between gap-2">
            <span className="text-ink">
              {it.quantity}× {it.name}
              {it.options.length > 0 && (
                <span className="text-ink-muted">
                  {" "}
                  ({it.options.map((o) => o.name).join(", ")})
                </span>
              )}
            </span>
            <span className="text-ink-muted">{formatPrice(it.unitPrice)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
        <span>Total</span>
        <span className={cancelled ? "text-ink-muted line-through" : undefined}>
          {formatPrice(order.totalAmount)}
        </span>
      </div>

      {onCancel && order.status === "pending" && (
        <Button
          variant="danger"
          size="sm"
          className="mt-3 w-full"
          isDisabled={cancelling}
          onPress={() => onCancel(order)}
        >
          {cancelling ? "Cancelling…" : "Cancel order"}
        </Button>
      )}
    </div>
  );
}
