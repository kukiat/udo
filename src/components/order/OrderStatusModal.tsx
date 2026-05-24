"use client";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { OrderStatusCard } from "@/components/order/OrderStatus";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useTableOrders } from "@/hooks/useTableOrders";

export function OrderStatusModal({
  isOpen,
  onOpenChange,
  branchId,
  tableNo,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  tableNo: string;
}) {
  const {
    orders,
    loading,
    error,
    cancelTarget,
    cancelling,
    requestCancel,
    dismissCancel,
    confirmCancel,
  } = useTableOrders(branchId, tableNo, isOpen);

  return (
    <>
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <div className="border-b border-line px-4 py-4">
        <p className="text-xs text-ink-muted">Table {tableNo}</p>
        <h2 className="text-xl font-semibold text-ink">Your Orders</h2>
      </div>

      <div className="space-y-3 px-4 py-4">
        {loading ? (
          <Loading label="Loading orders…" />
        ) : error ? (
          <ErrorState message={error} />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Your placed orders will appear here with live status."
            action={
              <Button onPress={() => onOpenChange(false)}>Browse menu</Button>
            }
          />
        ) : (
          orders.map((o) => (
            <OrderStatusCard key={o.id} order={o} onCancel={requestCancel} />
          ))
        )}

        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="block w-full pt-2 text-center text-sm text-clay-700 hover:underline"
          >
            + Order more
          </button>
        )}
      </div>
    </Modal>

    <CancelOrderDialog
      order={cancelTarget}
      cancelling={cancelling}
      onConfirm={confirmCancel}
      onDismiss={dismissCancel}
    />
    </>
  );
}
