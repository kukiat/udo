"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { PaymentModal } from "@/components/pos/PaymentModal";
import { Receipt } from "@/components/pos/Receipt";
import { ShiftBar } from "@/components/pos/ShiftBar";
import { AccountMenu } from "@/components/ui/AccountMenu";
import { HomeLink } from "@/components/ui/HomeLink";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/fetcher";
import { formatPrice, type BillTotals } from "@/lib/utils";
import type {
  BillLineItem,
  PaymentMethod,
  PosSession,
  ReceiptData,
  Shift,
} from "@/types/pos";

type BillResponse = {
  bill: {
    subtotal: string;
    vat: string;
    serviceCharge: string;
    discount: string;
    totalAmount: string;
    status: string;
  };
  lineItems: BillLineItem[];
};

const billStatusTone = (s: string) =>
  s === "paid" ? "green" : s === "requested" ? "amber" : "neutral";

function PosPageInner() {
  const { branchId } = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const { user } = useAuth();

  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [selected, setSelected] = useState<PosSession | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const loadSessions = useCallback(async () => {
    const d = await api<{ sessions: PosSession[] }>(
      `/api/pos/sessions?branchId=${branchId}`,
    );
    setSessions(d.sessions);
    return d.sessions;
  }, [branchId]);

  const loadShift = useCallback(async () => {
    const d = await api<{ shifts: Shift[] }>(
      `/api/shifts?branchId=${branchId}&status=open`,
    );
    setShift(d.shifts.find((s) => s.cashierId === user?.id) ?? null);
  }, [branchId, user?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSessions(), loadShift()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadSessions, loadShift]);

  const selectSession = useCallback(async (s: PosSession) => {
    setSelected(s);
    setBill(null);
    try {
      const d = await api<BillResponse>(`/api/bills?sessionId=${s.sessionId}`);
      setBill(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bill");
    }
  }, []);

  // Auto-select the session passed via ?session= (e.g. from the waitstaff page).
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || !requestedSessionId) return;
    const match = sessions.find((s) => s.sessionId === requestedSessionId);
    if (match) {
      autoSelected.current = true;
      selectSession(match);
    }
  }, [requestedSessionId, sessions, selectSession]);

  const totals: BillTotals | null = bill
    ? {
        subtotal: parseFloat(bill.bill.subtotal),
        serviceCharge: parseFloat(bill.bill.serviceCharge),
        vat: parseFloat(bill.bill.vat),
        discount: parseFloat(bill.bill.discount),
        total: parseFloat(bill.bill.totalAmount),
      }
    : null;

  const confirmPayment = async (input: {
    method: PaymentMethod;
    tendered: string | null;
    discount: string;
  }) => {
    if (!selected) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api<{ receipt: ReceiptData }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          sessionId: selected.sessionId,
          method: input.method,
          tendered: input.tendered,
          discount: input.discount,
          shiftId: shift?.id ?? null,
        }),
      });
      setPayOpen(false);
      setReceipt(res.receipt);
      setSelected(null);
      setBill(null);
      await Promise.all([loadSessions(), loadShift()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HomeLink />
          <h1 className="text-2xl font-bold text-ink">Point of Sale</h1>
        </div>
        <AccountMenu />
      </div>

      <ShiftBar
        branchId={branchId}
        shift={shift}
        onChange={() => loadShift()}
      />

      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Open tables ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <EmptyState title="No open tables" description="Active dine-in sessions appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => selectSession(s)}
                  className={
                    "rounded-card border p-3 text-left transition-colors " +
                    (selected?.sessionId === s.sessionId
                      ? "border-clay-300 bg-clay-50"
                      : "border-line bg-white hover:bg-sand")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      Table {s.tableNumber}
                    </span>
                    <Badge tone={billStatusTone(s.billStatus)}>
                      {s.billStatus}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {s.orderCount} order{s.orderCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm font-medium text-ink">
                    {formatPrice(s.subtotal)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border border-line bg-white p-4 shadow-card">
          {!selected || !bill ? (
            <p className="py-12 text-center text-sm text-ink-muted">
              Select a table to view its bill.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">
                  Table {selected.tableNumber}
                </h2>
                <Badge tone={billStatusTone(bill.bill.status)}>
                  {bill.bill.status}
                </Badge>
              </div>

              <div className="mt-3 divide-y divide-line">
                {bill.lineItems.map((li, i) => (
                  <div key={i} className="flex justify-between gap-2 py-2 text-sm">
                    <div>
                      <span className="font-medium text-ink">
                        {li.quantity}× {li.name}
                      </span>
                      {li.options.length > 0 && (
                        <span className="block text-xs text-ink-muted">
                          {li.options.map((o) => o.name).join(", ")}
                        </span>
                      )}
                    </div>
                    <span className="text-ink-soft">
                      {formatPrice(parseFloat(li.unitPrice) * li.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {totals && (
                <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                  <Row label="Subtotal" value={totals.subtotal} />
                  {totals.serviceCharge > 0 && (
                    <Row label="Service charge" value={totals.serviceCharge} />
                  )}
                  <Row label="VAT" value={totals.vat} />
                  {totals.discount > 0 && (
                    <Row label="Discount" value={-totals.discount} />
                  )}
                  <div className="mt-1 flex justify-between border-t border-line pt-1 text-base font-bold text-ink">
                    <span>Total</span>
                    <span>{formatPrice(totals.total)}</span>
                  </div>
                </div>
              )}

              <Button
                className="mt-4 w-full"
                isDisabled={!shift || bill.bill.status === "paid"}
                onPress={() => setPayOpen(true)}
              >
                {bill.bill.status === "paid"
                  ? "Paid"
                  : shift
                    ? "Take payment"
                    : "Open a shift first"}
              </Button>
            </>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        totals={totals}
        tableNumber={selected?.tableNumber ?? ""}
        onConfirm={confirmPayment}
        processing={processing}
      />

      <Modal isOpen={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        {receipt && (
          <Receipt receipt={receipt} onClose={() => setReceipt(null)} />
        )}
      </Modal>
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PosPageInner />
    </Suspense>
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
