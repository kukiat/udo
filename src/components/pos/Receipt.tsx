"use client";

import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import type { ReceiptData } from "@/types/pos";

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  qr: "QR / e-wallet",
};

export function Receipt({
  receipt,
  onClose,
}: {
  receipt: ReceiptData;
  onClose: () => void;
}) {
  const { totals } = receipt;
  return (
    <div className="p-5">
      <div id="receipt-print" className="mx-auto max-w-xs text-sm text-ink">
        <div className="text-center">
          <p className="text-base font-bold">{receipt.restaurantName}</p>
          <p className="text-xs font-medium text-ink-soft">{receipt.branchName}</p>
          {receipt.branchAddress && (
            <p className="text-xs text-ink-muted">{receipt.branchAddress}</p>
          )}
          <p className="mt-2 text-sm font-semibold">Payment Receipt</p>
          <p className="text-xs text-ink-muted">Table {receipt.tableNumber}</p>
        </div>
        <hr className="my-3 border-line" />
        <div className="flex flex-col gap-2">
          {receipt.lineItems.map((li, i) => {
            const optionTotal = li.options.reduce(
              (sum, option) => sum + parseFloat(option.price),
              0,
            );
            const lineTotal = li.quantity * (parseFloat(li.unitPrice) + optionTotal);

            return (
              <div key={`${li.orderNumber}-${li.name}-${i}`} className="space-y-0.5">
                <div className="flex justify-between gap-2">
                  <span>
                    {li.quantity}x {li.name}
                  </span>
                  <span>{formatPrice(lineTotal)}</span>
                </div>
                <div className="pl-3 text-xs text-ink-muted">
                  <p>{li.orderNumber}</p>
                  {li.options.map((option, optionIndex) => (
                    <div
                      key={`${option.name}-${optionIndex}`}
                      className="flex justify-between gap-2"
                    >
                      <span>+ {option.name}</span>
                      <span>{formatPrice(parseFloat(option.price) * li.quantity)}</span>
                    </div>
                  ))}
                  {li.note && <p>Note: {li.note}</p>}
                </div>
              </div>
            );
          })}
          {receipt.lineItems.length === 0 && (
            <div className="text-center text-xs text-ink-muted">
              No order items recorded.
            </div>
          )}
        </div>
        <hr className="my-3 border-line" />
        <div className="flex flex-col gap-1">
          <Row label="Subtotal" value={totals.subtotal} />
          {totals.serviceCharge > 0 && (
            <Row label="Service charge" value={totals.serviceCharge} />
          )}
          <Row label="VAT" value={totals.vat} />
          {totals.discount > 0 && (
            <Row label="Discount" value={-totals.discount} />
          )}
          <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
            <span>Total</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>
        <hr className="my-3 border-line" />
        <div className="flex flex-col gap-1">
          <Row label={`Paid (${METHOD_LABEL[receipt.method]})`} value={totals.total} />
          {receipt.tendered !== null && (
            <Row label="Tendered" value={receipt.tendered} />
          )}
          {receipt.change !== null && <Row label="Change" value={receipt.change} />}
        </div>
        <p className="mt-4 text-center text-xs text-ink-muted">Thank you!</p>
      </div>

      <div className="mt-5 flex gap-2 print:hidden">
        <Button variant="secondary" className="flex-1" onPress={() => window.print()}>
          Print
        </Button>
        <Button className="flex-1" onPress={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-soft">{label}</span>
      <span>{formatPrice(value)}</span>
    </div>
  );
}
