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
import { cn } from "@/lib/cn";
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

const THEME_KEY = "rms.pos.theme";

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

function PosPageInner() {
  const { branchId } = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const { user } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored === "light" || stored === "dark" ? stored : "dark";
    } catch {
      return "dark";
    }
  });

  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [selected, setSelected] = useState<PosSession | null>(null);
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("kds-theme");
    if (theme === "dark") root.classList.add("kds-dark");
    else root.classList.remove("kds-dark");
    return () => {
      root.classList.remove("kds-theme", "kds-dark");
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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

  if (loading) {
    return (
      <div
        suppressHydrationWarning
        className={cn(
          "kds-theme flex min-h-screen items-center justify-center",
          theme === "dark" && "kds-dark",
        )}
        style={{ background: "var(--bg)", color: "var(--ink)" }}
      >
        <Loading />
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={cn("kds-theme min-h-screen", theme === "dark" && "kds-dark")}
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <div className="mx-auto max-w-6xl p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-4">
          <HomeLink />
          <span aria-hidden className="h-6 w-px bg-line-strong/60" />
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Point of Sale
            </span>
            <span className="mono text-[11px] text-ink-dim">Cashier · register</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <AccountMenu compact />
        </div>
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
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Open tables
            </h2>
            <span className="mono text-[11px] tabular-nums text-ink-dim">
              {sessions.length}
            </span>
          </div>
          {sessions.length === 0 ? (
            <EmptyState title="No open tables" description="Active dine-in sessions appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => selectSession(s)}
                  className={cn(
                    "group rounded-card border p-3.5 text-left shadow-card transition-all",
                    selected?.sessionId === s.sessionId
                      ? "border-clay-500 bg-clay-100"
                      : "border-line bg-white hover:-translate-y-px hover:border-line-strong hover:bg-sand hover:shadow-elev",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tracking-tight text-ink">
                      Table {s.tableNumber}
                    </span>
                    <Badge tone={billStatusTone(s.billStatus)}>
                      {s.billStatus}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[12px] text-ink-muted">
                    {s.orderCount} order{s.orderCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {s.partySize ? `${s.partySize} guests · ` : ""}
                    Seated {formatClock(s.seatedAt)}
                  </p>
                  {s.expectedLeaveAt && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Leave by {formatClock(s.expectedLeaveAt)}
                    </p>
                  )}
                  <p className="mono mt-1 text-[15px] font-semibold tabular-nums text-ink">
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
              {(selected.customerName ||
                selected.customerPhone ||
                selected.tableNote) && (
                <div className="mt-3 rounded-lg border border-line bg-sand px-3 py-2 text-[12px] text-ink-muted">
                  {(selected.customerName || selected.customerPhone) && (
                    <p className="font-medium text-ink">
                      {[selected.customerName, selected.customerPhone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {selected.tableNote && (
                    <p className="mt-1">{selected.tableNote}</p>
                  )}
                </div>
              )}

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
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                    <span className="text-[14px] font-semibold text-ink">Total</span>
                    <span className="mono text-[22px] font-semibold tabular-nums text-ink">
                      {formatPrice(totals.total)}
                    </span>
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
    </div>
  );
}

export default function PosPage() {
  return (
    <Suspense
      fallback={
        <div
          className="kds-theme kds-dark flex min-h-screen items-center justify-center"
          style={{ background: "var(--bg)", color: "var(--ink)" }}
        >
          <Loading />
        </div>
      }
    >
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

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const nextLabel = theme === "light" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Switch to ${nextLabel} theme`}
      className="btn-quiet h-9 rounded-full px-3 text-[12px] font-medium"
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-full",
          theme === "light" ? "bg-ink-muted" : "bg-clay-500",
        )}
      />
      {nextLabel}
    </button>
  );
}
