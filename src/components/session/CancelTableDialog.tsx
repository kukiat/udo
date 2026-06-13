"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";

export function CancelTableDialog({
  tableNumber,
  pendingOrderCount,
  cancelling,
  onConfirm,
  onDismiss,
  theme = "light",
}: {
  /** Opens the dialog when non-null. */
  tableNumber: string | null;
  pendingOrderCount: number;
  cancelling: boolean;
  onConfirm: (reason?: string) => void;
  onDismiss: () => void;
  theme?: "light" | "dark";
}) {
  const [reason, setReason] = useState("");

  // Reset the reason whenever a different table opens the dialog.
  useEffect(() => {
    setReason("");
  }, [tableNumber]);

  return (
    <Modal
      isOpen={Boolean(tableNumber)}
      onOpenChange={(o) => !o && onDismiss()}
      theme={theme}
      header={
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            Cancel table?
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--ink-3)" }}
          >
            {tableNumber
              ? `Table ${tableNumber} will be closed without payment.${
                  pendingOrderCount > 0
                    ? ` ${pendingOrderCount} pending/preparing order${
                        pendingOrderCount === 1 ? "" : "s"
                      } will be cancelled.`
                    : ""
                } This can't be undone.`
              : ""}
          </p>
        </div>
      }
      footer={
        <div className="flex gap-2">
          <PillButton
            tone="neutral"
            isDisabled={cancelling}
            onPress={onDismiss}
            className="flex-1"
          >
            Keep table
          </PillButton>
          <PillButton
            tone="danger"
            variant="outline"
            isDisabled={cancelling}
            onPress={() => onConfirm(reason)}
            className="flex-1"
          >
            {cancelling ? "Cancelling…" : "Cancel table"}
          </PillButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
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
            placeholder="e.g. opened by mistake, guests left"
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
      </div>
    </Modal>
  );
}
