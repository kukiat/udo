"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { OrderDTO } from "@/types";

export function CancelOrderDialog({
  order,
  cancelling,
  onConfirm,
  onDismiss,
}: {
  order: OrderDTO | null;
  cancelling: boolean;
  onConfirm: (reason?: string) => void;
  onDismiss: () => void;
}) {
  const [reason, setReason] = useState("");

  // Reset the reason whenever a different order opens the dialog.
  useEffect(() => {
    setReason("");
  }, [order?.id]);

  return (
    <Modal isOpen={Boolean(order)} onOpenChange={(o) => !o && onDismiss()}>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Cancel order?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {order
              ? `Order ${order.orderNumber} will be cancelled. This can't be undone.`
              : ""}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">
            Reason <span className="font-normal text-ink-muted">· optional</span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. ordered by mistake, changed my mind"
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-white px-2.5 py-2 text-[13px] text-ink outline-none focus:border-ink"
          />
        </label>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            isDisabled={cancelling}
            onPress={onDismiss}
          >
            Keep order
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            isDisabled={cancelling}
            onPress={() => onConfirm(reason)}
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
