"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import type { OrderDTO } from "@/types";

export function CancelOrderDialog({
  order,
  cancelling,
  onConfirm,
  onDismiss,
  theme = "light",
}: {
  order: OrderDTO | null;
  cancelling: boolean;
  onConfirm: (reason?: string) => void;
  onDismiss: () => void;
  theme?: "light" | "dark";
}) {
  const [reason, setReason] = useState("");

  // Reset the reason whenever a different order opens the dialog.
  useEffect(() => {
    setReason("");
  }, [order?.id]);

  return (
    <Modal
      isOpen={Boolean(order)}
      onOpenChange={(o) => !o && onDismiss()}
      className={theme === "dark" ? "kds-theme kds-dark" : undefined}
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Cancel order?
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--ink-3)" }}
          >
            {order
              ? `Order ${order.orderNumber} will be cancelled. This can't be undone.`
              : ""}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span
            className="text-[13px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Reason{" "}
            <span className="font-normal" style={{ color: "var(--ink-3)" }}>
              · optional
            </span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ordered by mistake, changed my mind"
            rows={2}
            className="w-full resize-none rounded-lg border px-2.5 py-2 text-[13px] outline-none"
            style={{
              background: "var(--bg-elev)",
              borderColor: "var(--line-strong)",
              color: "var(--ink)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--ink)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--line-strong)";
            }}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={cancelling}
            onClick={onDismiss}
            className="flex-1 inline-flex items-center justify-center gap-2 font-medium text-sm px-4 py-2 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "transparent",
              borderColor: "var(--line-strong)",
              color: "var(--ink)",
            }}
            onMouseEnter={(e) => {
              if (!cancelling)
                e.currentTarget.style.background = "var(--bg-sunken)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Keep order
          </button>
          <button
            type="button"
            disabled={cancelling}
            onClick={() => onConfirm(reason)}
            className="flex-1 inline-flex items-center justify-center gap-2 font-medium text-sm px-4 py-2 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "var(--rose-soft)",
              borderColor: "var(--rose)",
              color: "var(--rose)",
            }}
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
