"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import type { OrderDTO } from "@/types";

type TablesResponse = { tables: { id: string; tableNumber: string }[] };
type OrdersResponse = { orders: OrderDTO[] };

export function useTableOrders(
  branchId: string,
  tableNo: string,
  enabled = true,
) {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const requestCancel = (order: OrderDTO) => setCancelTarget(order);
  const dismissCancel = () => {
    if (!cancelling) setCancelTarget(null);
  };

  const confirmCancel = async (reason?: string) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason?.trim() || "Cancelled by customer",
        }),
      });
      // Socket broadcast updates the card to cancelled.
      setCancelTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
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
  }, [branchId, tableNo, enabled]);

  return {
    orders,
    loading,
    error,
    cancelTarget,
    cancelling,
    requestCancel,
    dismissCancel,
    confirmCancel,
  };
}
