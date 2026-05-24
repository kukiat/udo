import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { OrderDTO, OrderStatus } from "@/types";

// Valid forward transitions for an order's lifecycle. An order may be cancelled
// only before the kitchen has finished it (pending/preparing).
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Whether an order is still in a state that allows cancellation. */
export function canCancel(status: OrderStatus): boolean {
  return status === "pending" || status === "preparing";
}

/** Load a single order with table, items, menu item names, and options. */
export async function loadOrderDTO(orderId: string): Promise<OrderDTO | null> {
  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, orderId),
    with: {
      table: { columns: { tableNumber: true } },
      items: {
        with: {
          menuItem: {
            columns: { name: true, kdsStationId: true },
            with: { category: { columns: { name: true } } },
          },
          options: {
            with: { optionItem: { columns: { name: true } } },
          },
        },
      },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    branchId: order.branchId,
    tableId: order.tableId,
    tableNumber: order.table.tableNumber,
    tableSessionId: order.tableSessionId,
    orderNumber: order.orderNumber,
    status: order.status,
    type: order.type,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason,
    items: order.items.map((it) => ({
      id: it.id,
      menuItemId: it.menuItemId,
      name: it.menuItem.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      note: it.note,
      kdsStationId: it.menuItem.kdsStationId,
      category: it.menuItem.category?.name ?? null,
      options: it.options.map((o) => ({
        id: o.id,
        optionItemId: o.optionItemId,
        name: o.optionItem.name,
        price: o.price,
      })),
    })),
  };
}
