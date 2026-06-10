"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/fetcher";
import { useOrderLink } from "@/lib/order-link";
import { getSocket } from "@/lib/socket-client";
import { formatPrice } from "@/lib/utils";
import type { BillPaidPayload, BillStatus } from "@/types";

type TablesResponse = { tables: { id: string; tableNumber: string }[] };
type SessionResponse = { session: { id: string } | null };
type LineItem = {
  orderNumber: string;
  name: string;
  quantity: number;
  unitPrice: string;
  options: { name: string; price: string }[];
};
type BillResponse = {
  bill: {
    id: string;
    subtotal: string;
    vat: string;
    serviceCharge: string;
    discount: string;
    totalAmount: string;
    status: BillStatus;
  };
  lineItems: LineItem[];
};

export default function BillPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const cart = useCart();
  const orderLink = useOrderLink();
  const sParam = useSearchParams().get("s");
  usePageTitle(`Bill — Table ${tableNo}`);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [data, setData] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await api<TablesResponse>(`/api/tables?branchId=${branchId}`);
      const tableId = t.tables.find((x) => x.tableNumber === tableNo)?.id;
      if (!tableId) throw new Error("Table not found");
      const s = await api<SessionResponse>(
        `/api/sessions?tableId=${tableId}&status=active`,
      );
      if (!s.session) {
        setSessionId(null);
        setData(null);
        return;
      }
      setSessionId(s.session.id);
      const b = await api<BillResponse>(`/api/bills?sessionId=${s.session.id}`);
      setData(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bill");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, tableNo]);

  // Once the bill is paid the order is done — drop the saved cart.
  useEffect(() => {
    if (data?.bill.status === "paid") {
      cart.clear();
      setCompleted(true);
    }
  }, [data?.bill.status, cart.clear]);

  // Live "bill settled" popup: staff takes payment elsewhere (POS), and the
  // table session closes — surface it to the guest in real time.
  useEffect(() => {
    const socket = getSocket();
    let cancelled = false;

    const onPaid = (p: BillPaidPayload) => {
      if (sParam && p.sessionId !== sParam) return;
      cart.clear();
      setCompleted(true);
    };

    (async () => {
      try {
        const t = await api<TablesResponse>(`/api/tables?branchId=${branchId}`);
        if (cancelled) return;
        const tableId = t.tables.find((x) => x.tableNumber === tableNo)?.id;
        if (!tableId) return;
        socket.emit("table:join", { tableId });
        socket.on("bill:paid", onPaid);
      } catch {
        // best-effort; the popup also fires when load() sees a paid bill
      }
    })();

    return () => {
      cancelled = true;
      socket.off("bill:paid", onPaid);
    };
  }, [branchId, tableNo, sParam, cart.clear]);

  const requestCheck = async () => {
    if (!sessionId) return;
    setRequesting(true);
    setRequestError(null);
    try {
      await api("/api/bills/request-check", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      await load();
    } catch (e) {
      setRequestError(
        e instanceof Error ? e.message : "Failed to request check",
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <header className="px-4 pb-5 pt-5 lg:px-8 lg:pt-10">
        <Link
          href={orderLink(`/order/${branchId}/${tableNo}`)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to menu
        </Link>
        <div className="mt-4 rounded-card border border-line bg-white p-5 shadow-card">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Bill · Table {tableNo}
          </div>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.1] text-ink lg:text-[40px]">
            Check, please
          </h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            Review all orders from this table. A server will come over once you
            request the check.
          </p>
        </div>
      </header>

      <main className="px-4 py-5 lg:px-8">
        {loading ? (
          <Loading label="Loading bill…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data ? (
          <EmptyState
            title="No active bill"
            description="Place an order first to open a bill for this table."
            action={
              <Link href={orderLink(`/order/${branchId}/${tableNo}`)}>
                <Button>Browse menu</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex justify-end">
              <BillStatusPill status={data.bill.status} />
            </div>

            <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
              <ul>
                {data.lineItems.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-line p-4 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <span className="mono mr-1.5 tabular-nums text-ink-muted">
                          {it.quantity}×
                        </span>
                        {it.name}
                      </p>
                      {it.options.length > 0 && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {it.options.map((o) => o.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="mono shrink-0 text-sm tabular-nums text-ink-muted">
                      {formatPrice(parseFloat(it.unitPrice) * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-2 border-t border-line-strong bg-[var(--bg-sunken)] p-5 text-sm tabular-nums">
                <Row label="Subtotal" value={formatPrice(data.bill.subtotal)} />
                {parseFloat(data.bill.serviceCharge) > 0 && (
                  <Row
                    label="Service charge"
                    value={formatPrice(data.bill.serviceCharge)}
                    muted
                  />
                )}
                <Row label="VAT" value={formatPrice(data.bill.vat)} muted />
                {parseFloat(data.bill.discount) > 0 && (
                  <Row
                    label="Discount"
                    value={`−${formatPrice(data.bill.discount)}`}
                    muted
                  />
                )}
                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-[14px] font-semibold text-ink">Total</dt>
                  <dd className="mono text-[22px] font-semibold tabular-nums text-ink">
                    {formatPrice(data.bill.totalAmount)}
                  </dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              disabled={requesting || data.bill.status !== "open"}
              onClick={requestCheck}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay-500 px-4 py-3.5 text-sm font-semibold text-white shadow-pop transition-colors hover:bg-clay-600 disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-muted"
            >
              {data.bill.status === "open"
                ? requesting
                  ? "Requesting…"
                  : "Request check"
                : "Check requested"}
            </button>
          </>
        )}
      </main>

      <Modal
        isOpen={completed}
        onOpenChange={(open) => {
          if (!open) setCompleted(false);
        }}
        className="order-modal-theme sm:max-w-sm"
      >
        <div className="p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-100 text-2xl text-green-600">
            ✓
          </div>
          <h2 className="mt-3 text-[17px] font-semibold text-ink">
            Bill settled
          </h2>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Your payment is complete and this table’s session is now closed.
            Thank you for dining with us!
          </p>
          <Link href="/" className="mt-5 block">
            <Button className="w-full">Done</Button>
          </Link>
        </div>
      </Modal>

      <Modal
        isOpen={requestError !== null}
        onOpenChange={(open) => {
          if (!open) setRequestError(null);
        }}
        className="sm:max-w-sm"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-700"
            >
              !
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">
                Can’t request check yet
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{requestError}</p>
            </div>
          </div>
          <Button
            className="mt-5 w-full"
            onPress={() => setRequestError(null)}
          >
            Got it
          </Button>
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

function BillStatusPill({ status }: { status: BillStatus }) {
  const tone: Record<
    BillStatus,
    { bg: string; fg: string; label: string; dot: boolean }
  > = {
    open: { bg: "bg-sand", fg: "text-ink-soft", label: "Open", dot: false },
    requested: {
      bg: "bg-amber-soft",
      fg: "text-amber",
      label: "Check requested",
      dot: true,
    },
    paid: {
      bg: "bg-olive-soft",
      fg: "text-olive",
      label: "Paid",
      dot: false,
    },
  };
  const t = tone[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${t.bg} ${t.fg}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${t.dot ? "animate-udo-blink" : ""}`}
      />
      {t.label}
    </span>
  );
}
