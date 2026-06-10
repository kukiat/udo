"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { OrderStatusCard } from "@/components/order/OrderStatus";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTableOrders } from "@/hooks/useTableOrders";
import { useOrderLink } from "@/lib/order-link";

export default function OrderStatusPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();
  const orderLink = useOrderLink();
  usePageTitle(`Order status — Table ${tableNo}`);

  const {
    orders,
    loading,
    error,
    cancelTarget,
    cancelling,
    requestCancel,
    dismissCancel,
    confirmCancel,
  } = useTableOrders(branchId, tableNo);

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <header className="px-4 pb-5 pt-5 lg:px-8 lg:pt-10">
        <div className="flex items-center justify-between">
          <Link
            href={orderLink(`/order/${branchId}/${tableNo}`)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-sand hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M13 8H3M7 4 3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to menu
          </Link>
          <Link href={orderLink(`/order/${branchId}/${tableNo}/bill`)}>
            <Button variant="secondary" size="sm">
              Bill
            </Button>
          </Link>
        </div>
        <div className="mt-4 rounded-card border border-line bg-white p-5 shadow-card">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            Table {tableNo} · live status
          </div>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.1] text-ink lg:text-[40px]">
            Your orders
          </h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            Updates arrive in real time — the kitchen sees changes the moment
            they happen.
          </p>
        </div>
      </header>

      <main className="space-y-4 px-4 py-5 lg:px-8">
        {loading ? (
          <Loading label="Loading orders…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your placed orders will appear here with live status."
            action={
              <Link href={orderLink(`/order/${branchId}/${tableNo}`)}>
                <Button>Browse menu</Button>
              </Link>
            }
          />
        ) : (
          orders.map((o) => (
            <OrderStatusCard key={o.id} order={o} onCancel={requestCancel} />
          ))
        )}

        {orders.length > 0 && (
          <Link
            href={orderLink(`/order/${branchId}/${tableNo}`)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-white py-3 text-sm font-medium text-ink transition-colors hover:bg-sand"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Order more
          </Link>
        )}
      </main>

      <CancelOrderDialog
        order={cancelTarget}
        cancelling={cancelling}
        onConfirm={confirmCancel}
        onDismiss={dismissCancel}
        theme="dark"
      />
    </div>
  );
}
