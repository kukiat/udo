"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/fetcher";
import { calcTotals, formatPrice, type BranchSettings } from "@/lib/utils";
import type { OrderDTO } from "@/types";

type BranchResponse = {
  branch: { id: string; settings: BranchSettings };
};
type TablesResponse = {
  tables: { id: string; tableNumber: string }[];
};

export default function CartPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const router = useRouter();
  const cart = useCart();

  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    lineId: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api<BranchResponse>(`/api/branches/${branchId}`),
      api<TablesResponse>(`/api/tables?branchId=${branchId}`),
    ])
      .then(([b, t]) => {
        setSettings(b.branch.settings);
        setTableId(t.tables.find((x) => x.tableNumber === tableNo)?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, [branchId, tableNo]);

  const totals = settings ? calcTotals(cart.subtotal, settings) : null;

  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0);

  const placeOrder = async () => {
    if (!tableId) {
      setError("Could not resolve this table.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api<{ order: OrderDTO }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          branchId,
          tableId,
          type: "dine_in",
          items: cart.lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            note: l.note || null,
            optionItemIds: l.options.map((o) => o.optionItemId),
          })),
        }),
      });
      cart.clear();
      router.push(`/order/${branchId}/${tableNo}/status`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  };

  const empty = cart.lines.length === 0;

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <header className="sticky top-0 z-10 border-b border-line bg-white px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/order/${branchId}/${tableNo}`}
            className="text-[12.5px] font-semibold text-ink-muted hover:text-ink"
          >
            ← Back to menu
          </Link>
          <Link
            href={`/order/${branchId}/${tableNo}/status`}
            className="text-[12.5px] font-semibold text-ink-muted hover:text-ink"
          >
            Order Status →
          </Link>
        </div>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-ink">
          Your order
        </h1>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Table {tableNo} · {itemCount} item{itemCount === 1 ? "" : "s"}
        </p>
      </header>

      <main className="px-4 py-4 pb-32">
        {empty ? (
          <EmptyState
            title="Nothing in your order yet"
            description="Add some items from the menu to get started."
            action={
              <Link href={`/order/${branchId}/${tableNo}`}>
                <Button>Browse menu</Button>
              </Link>
            }
          />
        ) : (
          <>
            <ul>
              {cart.lines.map((l) => {
                const lineTotal =
                  l.quantity *
                  (parseFloat(l.unitPrice) +
                    l.options.reduce((s, o) => s + parseFloat(o.price), 0));
                const extras = l.options.filter((o) => parseFloat(o.price) > 0);
                return (
                  <li
                    key={l.lineId}
                    className="grid grid-cols-[1fr_auto] gap-2.5 border-b border-line py-3"
                  >
                    <div className="flex min-w-0 gap-2.5">
                      <div className="inline-flex h-fit items-center rounded-full border border-line">
                        <button
                          onClick={() =>
                            cart.updateQuantity(l.lineId, l.quantity - 1)
                          }
                          aria-label="Decrease"
                          className="grid h-7 w-7 place-items-center rounded-full text-[16px] leading-none text-ink hover:bg-sand"
                        >
                          −
                        </button>
                        <span className="min-w-[22px] text-center text-[13px] font-semibold">
                          {l.quantity}
                        </span>
                        <button
                          onClick={() =>
                            cart.updateQuantity(l.lineId, l.quantity + 1)
                          }
                          aria-label="Increase"
                          className="grid h-7 w-7 place-items-center rounded-full text-[16px] leading-none text-ink hover:bg-sand"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="text-[14px] font-semibold text-ink">
                          {l.name}
                        </div>
                        {l.options.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
                            {l.options.map((o, i) => (
                              <span key={i}>
                                {i > 0 && "• "}
                                {o.name}
                                {extras.includes(o)
                                  ? ` (+${formatPrice(o.price)})`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          value={l.note}
                          onChange={(e) =>
                            cart.updateNote(l.lineId, e.target.value)
                          }
                          placeholder="Add a note…"
                          className="mt-0.5 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[14px] font-semibold tabular-nums text-ink">
                        {formatPrice(lineTotal)}
                      </span>
                      <button
                        onClick={() =>
                          setRemoveTarget({ lineId: l.lineId, name: l.name })
                        }
                        aria-label="Remove"
                        className="grid h-[22px] w-[22px] place-items-center rounded-full text-[16px] leading-none text-ink-muted hover:bg-sand hover:text-ink"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 rounded-xl border border-line bg-white p-4">
              {!totals ? (
                <Loading label="Calculating…" />
              ) : (
                <dl className="flex flex-col gap-1 text-[13px] tabular-nums text-ink-muted">
                  <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
                  {totals.serviceCharge > 0 && (
                    <Row
                      label="Service charge"
                      value={formatPrice(totals.serviceCharge)}
                    />
                  )}
                  <Row label="VAT" value={formatPrice(totals.vat)} />
                  <div className="mt-1.5 flex justify-between border-t border-line pt-2 text-[15.5px] font-bold text-ink">
                    <dt>Total</dt>
                    <dd>{formatPrice(totals.total)}</dd>
                  </div>
                </dl>
              )}
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-600">{error}</p>
            )}
          </>
        )}
      </main>

      {!empty && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl bg-gradient-to-t from-cream via-cream to-transparent px-4 pb-5 pt-3">
          <button
            type="button"
            disabled={submitting || !tableId}
            onClick={placeOrder}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-clay-500 px-4 py-3.5 text-sm font-semibold text-white hover:bg-clay-600 disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-muted"
          >
            {submitting
              ? "Sending to kitchen…"
              : `Send to kitchen${totals ? ` · ${formatPrice(totals.total)}` : ""}`}
          </button>
        </div>
      )}

      <Modal
        isOpen={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <div className="p-5">
          <h2 className="text-[17px] font-semibold text-ink">Remove item?</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Remove {removeTarget?.name} from your order?
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button variant="secondary" onPress={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              onPress={() => {
                if (removeTarget) cart.removeLine(removeTarget.lineId);
                setRemoveTarget(null);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
