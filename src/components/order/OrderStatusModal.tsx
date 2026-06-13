"use client";

import { CancelOrderDialog } from "@/components/order/CancelOrderDialog";
import { OrderStatusCard } from "@/components/order/OrderStatus";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useTableOrders } from "@/hooks/useTableOrders";
import { PlusIcon } from "lucide-react";
import { PillButton } from "../ui/PillButton";

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
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="order-modal-theme"
      header={
        <div>
          <p className="text-xs text-ink-muted">Table {tableNo}</p>
          <h2 className="text-xl font-semibold text-ink">Your Orders</h2>
        </div>
      }
    >
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
          <PillButton
            onPress={() => onOpenChange(false)}
            className="w-full"
          >
            <PlusIcon className="w-4 h-4" />
            Order more
          </PillButton>
        )}
      </div>
    </Modal>

    <CancelOrderDialog
      order={cancelTarget}
      cancelling={cancelling}
      onConfirm={confirmCancel}
      onDismiss={dismissCancel}
      theme="dark"
    />
    </>
  );
}
