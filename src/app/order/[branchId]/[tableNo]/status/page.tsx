"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { OrderStatusCard } from "@/components/order/OrderStatus";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import type { OrderDTO } from "@/types";

type TablesResponse = { tables: { id: string; tableNumber: string }[] };
type OrdersResponse = { orders: OrderDTO[] };

export default function OrderStatusPage() {
  const { branchId, tableNo } = useParams<{
    branchId: string;
    tableNo: string;
  }>();

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const cancelOrder = async (order: OrderDTO) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    setCancellingId(order.id);
    try {
      await api(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by customer" }),
      });
      // Socket broadcast updates the card to cancelled.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    let tableId: string | null = null;
    const socket = getSocket();

    const onUpdate = ({ order }: { order: OrderDTO }) => {
      setOrders((prev) =>
        prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [order, ...prev],
      );
    };

    (async () => {
      try {
        const t = await api<TablesResponse>(`/api/tables?branchId=${branchId}`);
        tableId = t.tables.find((x) => x.tableNumber === tableNo)?.id ?? null;
        if (!tableId) {
          setError("Table not found.");
          setLoading(false);
          return;
        }
        const o = await api<OrdersResponse>(`/api/orders?tableId=${tableId}`);
        setOrders(o.orders);
        socket.emit("table:join", { tableId });
        socket.on("order:status-update", onUpdate);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      socket.off("order:status-update", onUpdate);
    };
  }, [branchId, tableNo]);

  return (
    <div>
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
            <OrderStatusCard
              key={o.id}
              order={o}
              onCancel={cancelOrder}
              cancelling={cancellingId === o.id}
            />
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
    </div>
  );
}
