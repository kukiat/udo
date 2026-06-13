"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { BillTotals } from "@/lib/utils";
import type { PaymentMethod } from "@/types/pos";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "qr", label: "QR / e-wallet" },
];

export function PaymentModal({
  isOpen,
  onClose,
  totals,
  tableNumber,
  onConfirm,
  processing,
}: {
  isOpen: boolean;
  onClose: () => void;
  totals: BillTotals | null;
  tableNumber: string;
  onConfirm: (input: {
    method: PaymentMethod;
    tendered: string | null;
    discount: string;
  }) => void;
  processing: boolean;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [discount, setDiscount] = useState("0");

  // Recompute the total live as the discount changes (VAT/service are fixed
  // on the pre-discount subtotal, matching calcTotals on the server).
  const total = useMemo(() => {
    if (!totals) return 0;
    const preDiscount = totals.subtotal + totals.serviceCharge + totals.vat;
    const d = parseFloat(discount) || 0;
    return Math.max(0, Math.round((preDiscount - d) * 100) / 100);
  }, [totals, discount]);

  const change = useMemo(() => {
    const t = parseFloat(tendered);
    return Number.isFinite(t) ? Math.max(0, t - total) : 0;
  }, [tendered, total]);

  const cashShort =
    method === "cash" && tendered !== "" && parseFloat(tendered) < total;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(o) => !o && onClose()}
      header={
        <div>
          <h2 className="text-lg font-bold text-ink">Take payment</h2>
          <p className="text-sm text-ink-muted">Table {tableNumber}</p>
        </div>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onPress={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            isDisabled={processing || cashShort}
            onPress={() =>
              onConfirm({
                method,
                tendered: method === "cash" && tendered !== "" ? tendered : null,
                discount: discount || "0",
              })
            }
          >
            {processing ? "Processing…" : "Confirm payment"}
          </Button>
        </div>
      }
    >
      <div className="p-5 pt-4">
        <div className="rounded-xl bg-sand p-3 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-muted">
            Total due
          </p>
          <p className="text-2xl font-bold text-ink">{formatPrice(total)}</p>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-ink-soft">Method</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  method === m.id
                    ? "border-clay-300 bg-clay-50 text-clay-700"
                    : "border-line bg-white text-ink-soft hover:bg-sand",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-soft">Discount</span>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-32 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
        </label>

        {method === "cash" && (
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-soft">
              Cash tendered
            </span>
            <input
              type="number"
              min="0"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              placeholder={String(total)}
              className="w-40 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
            />
            {tendered !== "" && !cashShort && (
              <span className="text-sm text-ink-soft">
                Change: {formatPrice(change)}
              </span>
            )}
            {cashShort && (
              <span className="text-xs text-red-600">
                Tendered is less than the total due
              </span>
            )}
          </label>
        )}
      </div>
    </Modal>
  );
}
