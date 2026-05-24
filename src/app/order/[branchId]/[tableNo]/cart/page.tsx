"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
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

  const totals = settings
    ? calcTotals(cart.subtotal, settings)
    : null;

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

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-cream/90 px-4 py-4 backdrop-blur">
        <Link
          href={`/order/${branchId}/${tableNo}`}
          className="text-ink-muted hover:text-ink"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold text-ink">Your Cart</h1>
        <Link
          href={`/order/${branchId}/${tableNo}/status`}
          className="ml-auto text-sm font-medium text-clay-600 hover:text-clay-800"
        >
          Order Status →
        </Link>
      </header>

      <main className="px-4 py-4">
        {cart.lines.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description="Add some items from the menu to get started."
            action={
              <Link href={`/order/${branchId}/${tableNo}`}>
                <Button>Browse menu</Button>
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {cart.lines.map((l) => (
                <li
                  key={l.lineId}
                  className="rounded-card border border-line bg-white p-3 shadow-card"
                >
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{l.name}</p>
                      {l.options.length > 0 && (
                        <p className="text-xs text-ink-muted">
                          {l.options.map((o) => o.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => cart.removeLine(l.lineId)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={l.note}
                    onChange={(e) => cart.updateNote(l.lineId, e.target.value)}
                    placeholder="Add a note…"
                    className="mt-2 w-full rounded-lg border border-line bg-cream px-2.5 py-1.5 text-sm outline-none focus:border-clay-300"
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-line bg-white">
                      <button
                        onClick={() =>
                          cart.updateQuantity(l.lineId, l.quantity - 1)
                        }
                        className="px-3 py-1.5 text-ink-muted hover:bg-sand"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {l.quantity}
                      </span>
                      <button
                        onClick={() =>
                          cart.updateQuantity(l.lineId, l.quantity + 1)
                        }
                        className="px-3 py-1.5 text-ink-muted hover:bg-sand"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-semibold text-clay-700">
                      {formatPrice(
                        l.quantity *
                          (parseFloat(l.unitPrice) +
                            l.options.reduce(
                              (s, o) => s + parseFloat(o.price),
                              0,
                            )),
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-card border border-line bg-white p-4 shadow-card">
              {!totals ? (
                <Loading label="Calculating…" />
              ) : (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
                  {totals.serviceCharge > 0 && (
                    <Row
                      label="Service charge"
                      value={formatPrice(totals.serviceCharge)}
                    />
                  )}
                  <Row label="VAT" value={formatPrice(totals.vat)} />
                  <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
                    <dt>Total</dt>
                    <dd>{formatPrice(totals.total)}</dd>
                  </div>
                </dl>
              )}
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-600">{error}</p>
            )}

            <Button
              size="lg"
              className="mt-4 w-full"
              isDisabled={submitting || !tableId}
              onPress={placeOrder}
            >
              {submitting ? "Placing order…" : "Place order"}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
