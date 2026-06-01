"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/lib/fetcher";
import { useOrderLink } from "@/lib/order-link";
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
  const orderLink = useOrderLink();

  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  };

  const empty = cart.lines.length === 0;

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <header className="border-b border-line bg-cream px-4 pb-5 pt-5 lg:px-8 lg:pt-10">
        <Link
          href={orderLink(`/order/${branchId}/${tableNo}`)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to menu
        </Link>
        <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
          Your order
        </div>
        <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink lg:text-[40px]">
          Review &amp; send
        </h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          Table {tableNo} · {itemCount} item{itemCount === 1 ? "" : "s"} · Edit
          quantities or add a note for the kitchen.
        </p>
      </header>

      <main className="px-4 py-5 pb-32 lg:px-8 lg:py-8">
        {empty ? (
          <EmptyState
            title="Nothing in your order yet"
            description="Add some items from the menu to get started."
            action={
              <Link href={orderLink(`/order/${branchId}/${tableNo}`)}>
                <Button>Browse menu</Button>
              </Link>
            }
          />
        ) : (
          <>
            <ul className="overflow-hidden rounded-card border border-line bg-white shadow-card">
              {cart.lines.map((l) => {
                const lineTotal =
                  l.quantity *
                  (parseFloat(l.unitPrice) +
                    l.options.reduce((s, o) => s + parseFloat(o.price), 0));
                const extras = l.options.filter((o) => parseFloat(o.price) > 0);
                return (
                  <li
                    key={l.lineId}
                    className="grid grid-cols-[1fr_auto] gap-2.5 border-b border-line p-4 last:border-b-0"
                  >
                    <div className="flex min-w-0 gap-2.5">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                        <ItemSwatch
                          id={l.menuItemId}
                          name={l.name}
                          image={l.image}
                          size="lg"
                        />
                      </div>
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
                      <span className="mono text-[14px] font-semibold tabular-nums text-ink">
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

            <div className="mt-4 rounded-card border border-line bg-white p-5 shadow-card">
              {!totals ? (
                <Loading label="Calculating…" />
              ) : (
                <dl className="flex flex-col gap-2 text-[13px] tabular-nums">
                  <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
                  {totals.serviceCharge > 0 && (
                    <Row
                      label="Service charge"
                      value={formatPrice(totals.serviceCharge)}
                      muted
                    />
                  )}
                  <Row label="VAT" value={formatPrice(totals.vat)} muted />
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="text-[14px] font-semibold text-ink">Total</dt>
                    <dd className="mono text-[22px] font-semibold tabular-nums text-ink">
                      {formatPrice(totals.total)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <p className="mt-4 text-center text-[11px] text-ink-dim">
              By sending this order you agree to your table's service terms.
              Anything kept on file stays at this table.
            </p>

          </>
        )}
      </main>

      {!empty && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-cream via-cream/95 to-transparent px-4 pb-5 pt-6 lg:px-8">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Link
              href={orderLink(`/order/${branchId}/${tableNo}`)}
              className="hidden flex-1 items-center justify-center gap-2 rounded-sm border border-line-strong bg-white px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-sand sm:inline-flex"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Add more
            </Link>
            <button
              type="button"
              disabled={submitting || !tableId}
              onClick={placeOrder}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-sm bg-clay-500 px-4 py-3.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clay-600 disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-muted"
            >
              {submitting
                ? "Sending to kitchen…"
                : `Send to kitchen${totals ? ` · ${formatPrice(totals.total)}` : ""}`}
              {!submitting && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={success}
        onOpenChange={(open) => {
          if (!open) router.push(orderLink(`/order/${branchId}/${tableNo}`));
        }}
      >
        <div className="p-5 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-100 text-2xl text-green-600">
            ✓
          </div>
          <h2 className="mt-3 text-[17px] font-semibold text-ink">
            Sent to the kitchen
          </h2>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Your order is on its way. You can track its status anytime.
          </p>
          <Button
            className="mt-5 w-full"
            onPress={() => router.push(orderLink(`/order/${branchId}/${tableNo}`))}
          >
            Back to menu
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={error !== null}
        onOpenChange={(open) => !open && setError(null)}
      >
        <div className="p-5 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-2xl text-red-600">
            !
          </div>
          <h2 className="mt-3 text-[17px] font-semibold text-ink">
            Something went wrong
          </h2>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">{error}</p>
          <Button
            className="mt-5 w-full"
            onPress={() => router.push(orderLink(`/order/${branchId}/${tableNo}/bill`))}
          >
            Got it
          </Button>
        </div>
      </Modal>

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

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={muted ? "text-ink-muted" : "text-ink-soft"}>{label}</dt>
      <dd className={muted ? "text-ink-muted" : "text-ink"}>{value}</dd>
    </div>
  );
}
