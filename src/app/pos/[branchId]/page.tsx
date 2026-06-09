"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { TopBar } from "@/components/dashboard/TopBar";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { Receipt } from "@/components/pos/Receipt";
import { ShiftBar } from "@/components/pos/ShiftBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
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

type Branch = { id: string; name: string };
type BranchInfo = { id: string; name: string; restaurant: { name: string } };

const billStatusTone = (s: string) =>
  s === "paid" ? "green" : s === "requested" ? "amber" : "neutral";

const THEME_KEY = "rms.pos.theme";
const POS_ACTION_BUTTON = "!h-[34px] min-h-[34px] px-5";

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

function PosPageInner() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
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
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
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

  const loadBranch = useCallback(async () => {
    const d = await api<{ branch: BranchInfo }>(`/api/branches/${branchId}`);
    setBranch(d.branch);
  }, [branchId]);

  useEffect(() => {
    if (!user) return;
    api<{ branches: Branch[] }>(
      `/api/branches?restaurantId=${user.restaurantId}`,
    )
      .then((d) => setBranches(d.branches))
      .catch(() => setBranches([]));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSessions(), loadShift(), loadBranch()])
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loadSessions, loadShift, loadBranch]);

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
      <TopBar
        role="Staff Terminal"
        showLive={false}
        left={
          <PosBranchSwitcher
            branches={branches}
            branchId={branchId}
            restaurantName={branch?.restaurant?.name ?? null}
            activeBranchName={branch?.name ?? null}
            onChange={(id) => router.push(`/pos/${id}`)}
          />
        }
        right={
          <>
            <Link href={`/waitstaff/${branchId}`}>
              <PillButton className={POS_ACTION_BUTTON}>Waitstaff</PillButton>
            </Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </>
        }
      />

      <div className="mx-auto max-w-6xl p-5 md:p-7">
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
      className="btn-quiet flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12px] tracking-[0.02em] text-[var(--ink-2)]"
    >
      <span aria-hidden className="text-[13px] leading-none">
        {theme === "light" ? "◐" : "○"}
      </span>
      {nextLabel}
    </button>
  );
}

function PosBranchSwitcher({
  branches,
  branchId,
  restaurantName,
  activeBranchName,
  onChange,
}: {
  branches: { id: string; name: string }[];
  branchId: string | null;
  restaurantName: string | null;
  activeBranchName: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = `${restaurantName ?? "-"} · ${activeBranchName ?? ""}`;

  if (branches.length <= 1) {
    return (
      <span className="mono text-[11px] text-[var(--ink-4)]">
        {label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "mono inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-[11px] transition-colors",
          open
            ? "bg-[var(--bg-sunken)] text-[var(--ink-2)]"
            : "bg-transparent text-[var(--ink-4)] hover:bg-[var(--bg-sunken)] hover:text-[var(--ink-2)]",
        )}
      >
        <span className="max-w-[280px] truncate">{label}</span>
        <span
          aria-hidden
          className={cn(
            "text-[9px] opacity-70 transition-transform",
            open && "rotate-180",
          )}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-[95] mt-2 w-[288px] animate-slide-up rounded-[16px] border border-line bg-white p-2 shadow-pop">
          <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Switch branch
          </div>
          <div className="flex flex-col gap-0.5">
            {branches.map((b) => {
              const isActive = b.id === branchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-sunken)]",
                    isActive && "bg-[var(--bg-sunken)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md text-[14px]",
                      isActive
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--bg-sunken)] text-[var(--ink-3)]",
                    )}
                    aria-hidden
                  >
                    ⌂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold tracking-[-0.01em]">
                      {b.name}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="flex-shrink-0 text-[14px] text-clay-500"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
