import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { OrderDTO, OrderStatus, OrderType } from "@/types";

// Valid transitions for an order's lifecycle. Forward moves advance prep;
// kitchen staff may also step an order back one stage to correct a mistake
// (preparing → pending, ready → preparing). An order may be cancelled only
// before the kitchen has finished it (pending/preparing).
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "pending", "cancelled"],
  ready: ["served", "preparing"],
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

// Minimal shape needed to assemble an OrderDTO. Any query that wants to build a
// DTO (e.g. a write transaction reusing rows it already fetched) just has to
// load these relations so it can call buildOrderDTO without a second round-trip.
export type OrderDTOSource = {
  id: string;
  branchId: string;
  tableId: string;
  tableSessionId: string;
  orderNumber: string;
  status: OrderStatus;
  type: OrderType;
  totalAmount: string;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelReason: string | null;
  table: { tableNumber: string };
  items: {
    id: string;
    menuItemId: string;
    quantity: number;
    unitPrice: string;
    note: string | null;
    menuItem: {
      name: string;
      kdsStationId: string | null;
      category: { name: string } | null;
    };
    options: {
      id: string;
      optionItemId: string;
      price: string;
      optionItem: { name: string };
    }[];
  }[];
};

/** Assemble an OrderDTO from an already-loaded order row + relations. */
export function buildOrderDTO(order: OrderDTOSource): OrderDTO {
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
  return order ? buildOrderDTO(order) : null;
}
