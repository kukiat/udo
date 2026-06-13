"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ItemSwatch } from "@/components/menu/ItemSwatch";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { EmptyState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { usePageTitle } from "@/hooks/usePageTitle";
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
type NoteTarget = {
  lineId: string;
  name: string;
  note: string;
};

export default function CartPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const router = useRouter();
  const cart = useCart();
  const orderLink = useOrderLink();
  usePageTitle(`Cart — Table ${tableNo}`);

  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    lineId: string;
    name: string;
  } | null>(null);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [draftNote, setDraftNote] = useState("");

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
  const vatPercent = settings
    ? (settings.vatRate * 100).toFixed(2).replace(/\.?0+$/, "")
    : null;
  const servicePercent = settings
    ? (settings.serviceChargeRate * 100).toFixed(2).replace(/\.?0+$/, "")
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
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to place order");
      setSubmitting(false);
    }
  };

  const empty = cart.lines.length === 0;

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <header className="px-4 pb-4 pt-5 lg:px-8 lg:pt-8">
        <Link
          href={orderLink(`/order/${branchId}/${tableNo}`)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-sand"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to menu
        </Link>
        <div className="mt-4 rounded-card border border-line bg-white p-5 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Dine-in · Table {tableNo}
          </div>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] text-ink lg:text-[32px]">
            Your order
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {itemCount} item{itemCount === 1 ? "" : "s"} ready to send to the kitchen.
          </p>
        </div>
      </header>

      <main className="px-4 pb-8 lg:px-8">
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
                    className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:gap-4 lg:px-5"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-card bg-[var(--bg-sunken)]">
                      <ItemSwatch
                        id={l.menuItemId}
                        name={l.name}
                        image={l.image}
                        size="lg"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="text-[15px] font-semibold text-ink">
                        {l.name}
                      </div>
                      {l.options.length > 0 && (
                        <div className="text-[12.5px] text-ink-muted">
                          {l.options.map((o, i) => (
                            <span key={i}>
                              {i > 0 && ", "}
                              {o.name}
                              {extras.includes(o)
                                ? ` (+${formatPrice(o.price)})`
                                : ""}
                            </span>
                          ))}
                        </div>
                      )}
                      {l.note && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftNote(l.note);
                            setNoteTarget({
                              lineId: l.lineId,
                              name: l.name,
                              note: l.note,
                            });
                          }}
                          className="mt-0.5 truncate text-left text-[12px] italic text-ink-muted hover:text-ink"
                        >
                          “{l.note}”
                        </button>
                      )}
                      {!l.note && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftNote("");
                            setNoteTarget({
                              lineId: l.lineId,
                              name: l.name,
                              note: "",
                            });
                          }}
                          className="mt-0.5 self-start text-[12px] text-ink-dim hover:text-ink-muted"
                        >
                          + Add note
                        </button>
                      )}
                    </div>
                    <QuantityStepper
                      shape="rounded"
                      value={l.quantity}
                      onDecrease={() =>
                        l.quantity === 1
                          ? setRemoveTarget({ lineId: l.lineId, name: l.name })
                          : cart.updateQuantity(l.lineId, l.quantity - 1)
                      }
                      onIncrease={() =>
                        cart.updateQuantity(l.lineId, l.quantity + 1)
                      }
                    />
                    <div className="w-[68px] shrink-0 text-right text-[15px] font-semibold tabular-nums text-ink">
                      {formatPrice(lineTotal)}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 rounded-card border border-line bg-white px-5 py-4 shadow-card">
              {!totals ? (
                <Loading label="Calculating…" />
              ) : (
                <dl className="flex flex-col gap-2 text-[14px] tabular-nums">
                  <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
                  {totals.serviceCharge > 0 && (
                    <Row
                      label={`Service${servicePercent ? ` (${servicePercent}%)` : ""}`}
                      value={formatPrice(totals.serviceCharge)}
                      muted
                    />
                  )}
                  <Row
                    label={`Tax${vatPercent ? ` (${vatPercent}%)` : ""}`}
                    value={formatPrice(totals.vat)}
                    muted
                  />
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="text-[15px] font-semibold text-ink">Total</dt>
                    <dd className="text-[22px] font-semibold tabular-nums text-ink">
                      {formatPrice(totals.total)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </>
        )}
      </main>

      {!empty && (
        <div className="px-4 pb-8 lg:px-8">
          <div className="mx-auto flex max-w-3xl items-stretch gap-4">
            <Link
              href={orderLink(`/order/${branchId}/${tableNo}`)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:bg-sand"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Add more
            </Link>
            <button
              type="button"
              disabled={submitting || !tableId}
              onClick={placeOrder}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-clay-500 px-5 py-3.5 text-[14.5px] font-semibold text-white shadow-pop transition-colors hover:bg-clay-600 disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-muted"
            >
              {submitting
                ? "Placing order…"
                : `Place order${totals ? ` · ${formatPrice(totals.total)}` : ""}`}
              {!submitting && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <p className="mx-auto mt-4 max-w-md text-center text-[11.5px] text-ink-dim">
            By placing your order you agree to our table service terms. Card kept on file at the table.
          </p>
        </div>
      )}

      <Modal
        isOpen={success}
        className="order-modal-theme"
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
        className="order-modal-theme"
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
        className="order-modal-theme"
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        header={
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Remove item?</h2>
            <p className="mt-1.5 text-[13.5px] text-ink-muted">
              Remove {removeTarget?.name} from your order?
            </p>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2.5">
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
        }
      >
        <span className="sr-only">
          Confirm removing {removeTarget?.name} from your order.
        </span>
      </Modal>

      <Modal
        isOpen={noteTarget !== null}
        className="order-modal-theme"
        onOpenChange={(open) => !open && setNoteTarget(null)}
        header={
          <div>
            <h2 className="text-[17px] font-semibold text-ink">
              {noteTarget?.note ? "Edit kitchen note" : "Add kitchen note"}
            </h2>
            <p className="mt-1.5 text-[13.5px] text-ink-muted">
              {noteTarget?.name}
            </p>
          </div>
        }
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onPress={() => setNoteTarget(null)}>
              Cancel
            </Button>
            <Button
              onPress={() => {
                if (noteTarget) {
                  cart.updateNote(noteTarget.lineId, draftNote.trim());
                }
                setNoteTarget(null);
              }}
            >
              Save note
            </Button>
          </div>
        }
      >
        <div className="p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Note</span>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              rows={4}
              maxLength={500}
              autoFocus
              placeholder="e.g. no onions, sauce on the side"
              className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink"
            />
          </label>
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
