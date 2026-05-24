"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { OrderStatusCard } from "@/components/order/OrderStatus";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useTableOrders } from "@/hooks/useTableOrders";

export default function OrderStatusPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();

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
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream/90 px-4 py-4 backdrop-blur">
        <Link
          href={`/order/${branchId}/${tableNo}`}
          className="text-ink-muted hover:text-ink"
        >
          ←
        </Link>
        <div className="flex-1 ml-4">
          <p className="text-xs text-ink-muted">Table {tableNo}</p>
          <h1 className="text-xl font-semibold text-ink">Your Orders</h1>
        </div>
        <Link href={`/order/${branchId}/${tableNo}/bill`}>
          <Button variant="secondary" size="sm">
            Bill
          </Button>
        </Link>
      </header>

      <main className="space-y-3 px-4 py-4">
        {loading ? (
          <Loading label="Loading orders…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your placed orders will appear here with live status."
            action={
              <Link href={`/order/${branchId}/${tableNo}`}>
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
            href={`/order/${branchId}/${tableNo}`}
            className="block pt-2 text-center text-sm text-clay-700 hover:underline"
          >
            + Order more
          </Link>
        )}
      </main>

      <CancelOrderDialog
        order={cancelTarget}
        cancelling={cancelling}
        onConfirm={confirmCancel}
        onDismiss={dismissCancel}
      />
    </div>
  );
}
