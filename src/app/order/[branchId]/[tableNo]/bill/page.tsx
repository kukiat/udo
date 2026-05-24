"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useCart } from "@/contexts/CartContext";
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

const statusTone: Record<BillStatus, "neutral" | "amber" | "green"> = {
  open: "neutral",
  requested: "amber",
  paid: "green",
};
const statusLabel: Record<BillStatus, string> = {
  open: "Open",
  requested: "Check requested",
  paid: "Paid",
};

export default function BillPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const cart = useCart();
  const orderLink = useOrderLink();
  const sParam = useSearchParams().get("s");

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
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-cream/90 px-4 py-4 backdrop-blur">
        <Link
          href={orderLink(`/order/${branchId}/${tableNo}`)}
          className="text-ink-muted hover:text-ink"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold text-ink">Bill · Table {tableNo}</h1>
      </header>

      <main className="px-4 py-4">
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
            <div className="mb-3 flex justify-end">
              <Badge tone={statusTone[data.bill.status]}>
                {statusLabel[data.bill.status]}
              </Badge>
            </div>

            <div className="rounded-card border border-line bg-white shadow-card">
              <ul className="divide-y divide-line">
                {data.lineItems.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {it.quantity}× {it.name}
                      </p>
                      {it.options.length > 0 && (
                        <p className="text-xs text-ink-muted">
                          {it.options.map((o) => o.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-ink-muted">
                      {formatPrice(parseFloat(it.unitPrice) * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1.5 border-t border-line p-4 text-sm">
                <Row label="Subtotal" value={formatPrice(data.bill.subtotal)} />
                {parseFloat(data.bill.serviceCharge) > 0 && (
                  <Row
                    label="Service charge"
                    value={formatPrice(data.bill.serviceCharge)}
                  />
                )}
                <Row label="VAT" value={formatPrice(data.bill.vat)} />
                {parseFloat(data.bill.discount) > 0 && (
                  <Row
                    label="Discount"
                    value={`−${formatPrice(data.bill.discount)}`}
                  />
                )}
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
                  <dt>Total</dt>
                  <dd>{formatPrice(data.bill.totalAmount)}</dd>
                </div>
              </dl>
            </div>

            <Button
              size="lg"
              className="mt-4 w-full"
              isDisabled={requesting || data.bill.status !== "open"}
              onPress={requestCheck}
            >
              {data.bill.status === "open"
                ? requesting
                  ? "Requesting…"
                  : "Request check"
                : "Check requested"}
            </Button>
          </>
        )}
      </main>

      <Modal
        isOpen={completed}
        onOpenChange={(open) => {
          if (!open) setCompleted(false);
        }}
        className="sm:max-w-sm"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
