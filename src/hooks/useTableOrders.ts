"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useSocketRoom } from "@/hooks/useSocketRoom";
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
  const sessionId = useSearchParams().get("s");
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
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

  // Resolve the table id + initial orders for the session.
  useEffect(() => {
    if (!enabled) return;
    if (!sessionId) {
      setError("No active session for this table.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const t = await api<TablesResponse>(`/api/tables?branchId=${branchId}`);
        if (cancelled) return;
        const id = t.tables.find((x) => x.tableNumber === tableNo)?.id ?? null;
        if (!id) {
          setError("Table not found.");
          setLoading(false);
          return;
        }
        const o = await api<OrdersResponse>(
          `/api/orders?sessionId=${sessionId}`,
        );
        if (cancelled) return;
        setTableId(id);
        setOrders(o.orders);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, tableNo, enabled, sessionId]);

  // Join the table room — re-joins automatically on reconnect.
  useSocketRoom("table:join", tableId ? { tableId } : null, {
    enabled: enabled && !!sessionId,
  });

  // Live status updates broadcast to the table room; keep this session's orders.
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const socket = getSocket();
    const onUpdate = ({ order }: { order: OrderDTO }) => {
      if (order.tableSessionId !== sessionId) return;
      setOrders((prev) =>
        prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [order, ...prev],
      );
    };
    socket.on("order:status-update", onUpdate);
    return () => {
      socket.off("order:status-update", onUpdate);
    };
  }, [enabled, sessionId]);

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
