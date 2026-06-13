import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { canCancel, canTransition, loadOrderDTO } from "@/lib/orders";
import { emitNewOrder, emitOrderStatusUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import type { OrderCreateInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";
import type { OrderDTO, OrderStatus } from "@/types";

type Origin = { originSocketId?: string | null };

const billLocked = (verb: string) =>
  new ServiceError(
    "BILL_LOCKED",
    `The check has been requested for this table. Please ask staff to reopen the bill before ${verb}.`,
    409,
  );

/**
 * Place an order: snapshot effective prices from the catalog, open a table
 * session if none is active, persist the order + items + options in one
 * transaction, then broadcast `order:new`. Throws `BILL_LOCKED` if the
 * session's check has already been requested.
 */
export async function placeOrder(
  input: OrderCreateInput,
  { originSocketId }: Origin = {},
): Promise<OrderDTO> {
  const scope = `orders POST ${crypto.randomUUID().slice(0, 8)}`;
  const timed = makeTimer(scope);

  // --- Snapshot prices from the DB (never trust client prices) -------------
  const menuItemIds = [...new Set(input.items.map((i) => i.menuItemId))];
  const allOptionIds = [
    ...new Set(input.items.flatMap((i) => i.optionItemIds ?? [])),
  ];

  const [menuItems, branchOverrides, optionItems] = await timed(
    "snapshot prices",
    () =>
      Promise.all([
        db.query.menuItems.findMany({
          where: inArray(schema.menuItems.id, menuItemIds),
        }),
        db.query.branchMenuItems.findMany({
          where: eq(schema.branchMenuItems.branchId, input.branchId),
        }),
        allOptionIds.length
          ? db.query.optionItems.findMany({
              where: inArray(schema.optionItems.id, allOptionIds),
            })
          : Promise.resolve([]),
      ]),
  );

  const menuById = new Map(menuItems.map((m) => [m.id, m]));
  const overrideById = new Map(branchOverrides.map((o) => [o.menuItemId, o]));
  const optionById = new Map(optionItems.map((o) => [o.id, o]));

  for (const item of input.items) {
    if (!menuById.has(item.menuItemId)) {
      throw new ServiceError(
        "BAD_REQUEST",
        `Unknown menu item: ${item.menuItemId}`,
        400,
      );
    }
    const menu = menuById.get(item.menuItemId)!;
    const override = overrideById.get(item.menuItemId);
    if (
      menu.status !== "available" ||
      menu.deletedAt ||
      override?.isAvailable === false
    ) {
      throw new ServiceError(
        "BAD_REQUEST",
        `Menu item is not available: ${menu.name}`,
        400,
      );
    }
    for (const oid of item.optionItemIds ?? []) {
      if (!optionById.has(oid)) {
        throw new ServiceError("BAD_REQUEST", `Unknown option item: ${oid}`, 400);
      }
    }
  }

  const txStart = performance.now();
  const orderId = await db.transaction(async (tx) => {
    // Get or create the active session for this table.
    let session = await timed("select active session", () =>
      tx.query.tableSessions.findFirst({
        where: and(
          eq(schema.tableSessions.tableId, input.tableId),
          eq(schema.tableSessions.status, "active"),
        ),
      }),
    );
    if (session) {
      // Once the check has been requested (or the bill is paid), the table is
      // closing out — no further items may be added.
      const bill = await timed("select bill", () =>
        tx.query.bills.findFirst({
          where: eq(schema.bills.tableSessionId, session!.id),
          columns: { status: true },
        }),
      );
      if (bill && bill.status !== "open") throw billLocked("ordering more");
    }
    if (!session) {
      [session] = await timed("insert session", () =>
        tx
          .insert(schema.tableSessions)
          .values({ branchId: input.branchId, tableId: input.tableId })
          .returning(),
      );
      await timed("update table occupied", () =>
        tx
          .update(schema.tables)
          .set({ status: "occupied" })
          .where(eq(schema.tables.id, input.tableId)),
      );
    }

    // Sequential-ish order number, scoped to the branch.
    const countRows = await timed("count branch orders", () =>
      tx.query.orders.findMany({
        where: eq(schema.orders.branchId, input.branchId),
        columns: { id: true },
      }),
    );
    const orderNumber = `#${String(countRows.length + 1).padStart(4, "0")}`;

    let orderTotal = 0;
    const itemRows: {
      menuItemId: string;
      quantity: number;
      unitPrice: string;
      note: string | null;
      optionIds: string[];
      optionPrices: Map<string, string>;
    }[] = [];

    for (const item of input.items) {
      const menu = menuById.get(item.menuItemId)!;
      const effective = overrideById.get(item.menuItemId)?.price ?? menu.price;
      const optionPrices = new Map<string, string>();
      let optionsSum = 0;
      const optionIds = item.optionItemIds ?? [];
      for (const oid of optionIds) {
        const opt = optionById.get(oid)!;
        optionPrices.set(oid, opt.price);
        optionsSum += parseFloat(opt.price);
      }
      orderTotal += item.quantity * (parseFloat(effective) + optionsSum);
      itemRows.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: effective,
        note: item.note ?? null,
        optionIds,
        optionPrices,
      });
    }

    const [order] = await timed("insert order", () =>
      tx
        .insert(schema.orders)
        .values({
          branchId: input.branchId,
          tableId: input.tableId,
          tableSessionId: session!.id,
          orderNumber,
          type: input.type,
          status: "pending",
          totalAmount: orderTotal.toFixed(2),
        })
        .returning(),
    );

    for (const row of itemRows) {
      const [orderItem] = await timed("insert order item", () =>
        tx
          .insert(schema.orderItems)
          .values({
            orderId: order.id,
            menuItemId: row.menuItemId,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            note: row.note,
          })
          .returning(),
      );
      if (row.optionIds.length > 0) {
        await timed("insert order item options", () =>
          tx.insert(schema.orderItemOptions).values(
            row.optionIds.map((oid) => ({
              orderItemId: orderItem.id,
              optionItemId: oid,
              price: row.optionPrices.get(oid) ?? "0",
            })),
          ),
        );
      }
    }

    return order.id;
  });
  console.log(
    `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
  );

  const dto = await timed("load order dto", () => loadOrderDTO(orderId));
  if (dto) emitNewOrder(dto, originSocketId);
  // The order was just inserted; loadOrderDTO only returns null on a deleted
  // row, which cannot happen here.
  return dto!;
}

/**
 * Advance (or step back) an order's status, validating the transition, then
 * broadcast `order:status-update`. Throws NOT_FOUND / BAD_REQUEST.
 */
export async function transitionOrder(
  orderId: string,
  status: OrderStatus,
  { originSocketId }: Origin = {},
): Promise<OrderDTO> {
  const timed = makeTimer(
    `order-status PATCH ${orderId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  const current = await timed("select order status", () =>
    db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { status: true },
    }),
  );
  if (!current) throw new ServiceError("NOT_FOUND", "Order not found", 404);

  if (current.status !== status && !canTransition(current.status, status)) {
    throw new ServiceError(
      "BAD_REQUEST",
      `Invalid status transition: ${current.status} → ${status}`,
      400,
    );
  }

  await timed("update order status", () =>
    db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, orderId)),
  );

  const dto = await timed("load order dto", () => loadOrderDTO(orderId));
  if (dto) emitOrderStatusUpdate(dto, originSocketId);
  return dto!;
}

/**
 * Cancel a single order (pending/preparing only, and only while the bill is
 * still open), then broadcast `order:status-update`. Throws
 * NOT_FOUND / BAD_REQUEST / BILL_LOCKED.
 */
export async function cancelOrder(
  orderId: string,
  reason: string | null,
  { originSocketId }: Origin = {},
): Promise<OrderDTO> {
  const timed = makeTimer(
    `order-cancel POST ${orderId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  const current = await timed("select order", () =>
    db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { status: true, tableSessionId: true },
    }),
  );
  if (!current) throw new ServiceError("NOT_FOUND", "Order not found", 404);

  if (!canCancel(current.status)) {
    throw new ServiceError(
      "BAD_REQUEST",
      `Order cannot be cancelled once it is ${current.status}`,
      400,
    );
  }

  // Once the check has been requested (or the bill is paid), the table is
  // closing out — orders can no longer be cancelled.
  const bill = await timed("select bill", () =>
    db.query.bills.findFirst({
      where: eq(schema.bills.tableSessionId, current.tableSessionId),
      columns: { status: true },
    }),
  );
  if (bill && bill.status !== "open") throw billLocked("changing orders");

  await timed("update order cancelled", () =>
    db
      .update(schema.orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason,
      })
      .where(eq(schema.orders.id, orderId)),
  );

  const dto = await timed("load order dto", () => loadOrderDTO(orderId));
  if (dto) emitOrderStatusUpdate(dto, originSocketId);
  return dto!;
}
