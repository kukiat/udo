import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { buildOrderDTO, canCancel, canTransition, loadOrderDTO } from "@/lib/orders";
import { calcTotals, makeTimer, type Timed } from "@/lib/utils";
import type {
  OrderCreateInput,
  OrderItemDeleteInput,
  OrderItemUpdateInput,
} from "@/lib/validation";
import { ServiceError } from "@/services/errors";
import {
  socketEvents,
  type EventPublisher,
  type Origin,
} from "@/services/events";
import type { OrderDTO, OrderStatus } from "@/types";

// Statuses still relevant to the kitchen.
const KDS_ACTIVE: OrderStatus[] = ["pending", "preparing", "ready"];

const billLocked = (verb: string) =>
  new ServiceError(
    "BILL_LOCKED",
    `The check has been requested for this table. Please ask staff to reopen the bill before ${verb}.`,
    409,
  );

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type LockedBill = { id: string; discount: string } | null;

// Validate the order is still editable and, when a bill exists, lock its row
// FOR UPDATE. The lock serializes concurrent item edits on the same table so
// two requests can't read the same bill subtotal and clobber each other's
// update (a lost update). Postgres forbids FOR UPDATE on the nullable side of
// an outer join, so the bill is locked in its own statement rather than joined.
async function lockEditableOrder(
  tx: DbTransaction,
  orderId: string,
  timed: Timed,
): Promise<LockedBill> {
  const order = await timed("select order", () =>
    tx.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { status: true, tableSessionId: true },
    }),
  );
  if (!order) throw new ServiceError("NOT_FOUND", "Order item not found", 404);
  if (order.status !== "pending") {
    throw new ServiceError(
      "BAD_REQUEST",
      `Order items can only be edited while the order is pending. Current status: ${order.status}`,
      400,
    );
  }

  const [bill] = await timed("lock bill (for update)", () =>
    tx
      .select({
        id: schema.bills.id,
        status: schema.bills.status,
        discount: schema.bills.discount,
      })
      .from(schema.bills)
      .where(eq(schema.bills.tableSessionId, order.tableSessionId))
      .for("update"),
  );
  if (!bill) return null;
  if (bill.status !== "open") throw billLocked("changing orders");

  return { id: bill.id, discount: bill.discount };
}

// Recompute the edited order's total and, when the table has an (already
// locked) bill, roll the new subtotal up into it. Loads everything needed to
// both recompute totals AND build the response DTO in one query.
async function recalcOrderAndBill(
  tx: DbTransaction,
  orderId: string,
  bill: LockedBill,
  timed: Timed,
): Promise<OrderDTO> {
  const order = await timed("select order+items+session", () =>
    tx.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        table: { columns: { tableNumber: true } },
        items: {
          with: {
            menuItem: {
              columns: { name: true, kdsStationId: true },
              with: { category: { columns: { name: true } } },
            },
            options: { with: { optionItem: { columns: { name: true } } } },
          },
        },
        tableSession: {
          with: {
            branch: { columns: { settings: true } },
            orders: { columns: { id: true, status: true, totalAmount: true } },
          },
        },
      },
    }),
  );
  if (!order) throw new ServiceError("NOT_FOUND", "Order not found", 404);

  const orderTotal = order.items.reduce((sum, item) => {
    const optionTotal = item.options.reduce(
      (s, option) => s + parseFloat(option.price),
      0,
    );
    return sum + item.quantity * (parseFloat(item.unitPrice) + optionTotal);
  }, 0);
  const orderTotalStr = orderTotal.toFixed(2);

  await timed("update order total", () =>
    tx
      .update(schema.orders)
      .set({ totalAmount: orderTotalStr })
      .where(eq(schema.orders.id, orderId)),
  );

  if (bill) {
    const subtotal = order.tableSession.orders
      .filter((o) => o.status !== "cancelled")
      .reduce(
        (sum, o) =>
          sum + (o.id === orderId ? orderTotal : parseFloat(o.totalAmount)),
        0,
      );
    const totals = calcTotals(
      subtotal,
      order.tableSession.branch.settings,
      parseFloat(bill.discount),
    );

    await timed("update bill", () =>
      tx
        .update(schema.bills)
        .set({
          subtotal: totals.subtotal.toFixed(2),
          vat: totals.vat.toFixed(2),
          serviceCharge: totals.serviceCharge.toFixed(2),
          discount: totals.discount.toFixed(2),
          totalAmount: totals.total.toFixed(2),
        })
        .where(eq(schema.bills.id, bill.id)),
    );
  }

  return buildOrderDTO({ ...order, totalAmount: orderTotalStr });
}

export class OrderService {
  constructor(private readonly events: EventPublisher = socketEvents) {}

  /**
   * Place an order: snapshot effective prices from the catalog, open a table
   * session if none is active, persist the order + items + options in one
   * transaction, then broadcast `order:new`. Throws `BILL_LOCKED` if the
   * session's check has already been requested.
   */
  async place(
    input: OrderCreateInput,
    { originSocketId }: Origin = {},
  ): Promise<OrderDTO> {
    const scope = `orders POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);

    // --- Snapshot prices from the DB (never trust client prices) -----------
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
    if (dto) this.events.newOrder(dto, originSocketId);
    // The order was just inserted; loadOrderDTO only returns null on a deleted
    // row, which cannot happen here.
    return dto!;
  }

  /**
   * Advance (or step back) an order's status, validating the transition, then
   * broadcast `order:status-update`. Throws NOT_FOUND / BAD_REQUEST.
   */
  async transition(
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
    if (dto) this.events.orderStatusUpdate(dto, originSocketId);
    return dto!;
  }

  /**
   * Cancel a single order (pending/preparing only, and only while the bill is
   * still open), then broadcast `order:status-update`. Throws
   * NOT_FOUND / BAD_REQUEST / BILL_LOCKED.
   */
  async cancel(
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
    if (dto) this.events.orderStatusUpdate(dto, originSocketId);
    return dto!;
  }

  // --- Reads ----------------------------------------------------------------

  /**
   * List orders by one of: a table session, a table, or a branch. For a branch,
   * `active` restricts to the KDS set (pending/preparing/ready) and `statuses`
   * (an explicit set) overrides that. Branch results are oldest-first (FIFO);
   * table/session results newest-first.
   */
  async list(opts: {
    tableId: string | null;
    sessionId: string | null;
    branchId: string | null;
    active: boolean;
    statuses?: OrderStatus[];
  }): Promise<OrderDTO[]> {
    const timed = makeTimer(`orders GET ${crypto.randomUUID().slice(0, 8)}`);

    const where = opts.sessionId
      ? eq(schema.orders.tableSessionId, opts.sessionId)
      : opts.branchId
        ? opts.statuses && opts.statuses.length > 0
          ? and(
              eq(schema.orders.branchId, opts.branchId),
              inArray(schema.orders.status, opts.statuses),
            )
          : opts.active
            ? and(
                eq(schema.orders.branchId, opts.branchId),
                inArray(schema.orders.status, KDS_ACTIVE),
              )
            : eq(schema.orders.branchId, opts.branchId)
        : eq(schema.orders.tableId, opts.tableId!);

    const rows = await timed("select orders+items", () =>
      db.query.orders.findMany({
        where,
        orderBy: (o, { desc, asc }) =>
          opts.branchId ? [asc(o.createdAt)] : [desc(o.createdAt)],
        with: {
          table: { columns: { tableNumber: true } },
          items: {
            with: {
              menuItem: {
                columns: { name: true, kdsStationId: true },
                with: { category: { columns: { name: true } } },
              },
              options: { with: { optionItem: { columns: { name: true } } } },
            },
          },
        },
      }),
    );

    return rows.map(buildOrderDTO);
  }

  /** Load a single order DTO. Throws NOT_FOUND. */
  async get(id: string): Promise<OrderDTO> {
    const timed = makeTimer(
      `order GET ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const dto = await timed("load order dto", () => loadOrderDTO(id));
    if (!dto) throw new ServiceError("NOT_FOUND", "Order not found", 404);
    return dto;
  }

  // --- Item edits (quantity/note, remove) -----------------------------------

  /** Edit a pending order item's quantity/note, recompute totals, emit. */
  async updateItem(
    orderId: string,
    itemId: string,
    input: OrderItemUpdateInput,
    { originSocketId }: Origin = {},
  ): Promise<OrderDTO> {
    const scope = `order-item PATCH ${itemId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const dto = await db.transaction(async (tx) => {
      const bill = await lockEditableOrder(tx, orderId, timed);

      const updated = await timed("update item", () =>
        tx
          .update(schema.orderItems)
          .set({
            ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
          })
          .where(
            and(
              eq(schema.orderItems.id, itemId),
              eq(schema.orderItems.orderId, orderId),
            ),
          )
          .returning({ id: schema.orderItems.id }),
      );
      if (updated.length === 0) {
        throw new ServiceError("NOT_FOUND", "Order item not found", 404);
      }

      return recalcOrderAndBill(tx, orderId, bill, timed);
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
    );

    this.events.orderStatusUpdate(dto, originSocketId);
    return dto;
  }

  /** Remove a pending order item (not the last one), recompute totals, emit. */
  async removeItem(
    orderId: string,
    itemId: string,
    { originSocketId }: Origin = {},
  ): Promise<OrderDTO> {
    const scope = `order-item DELETE ${itemId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const dto = await db.transaction(async (tx) => {
      const bill = await lockEditableOrder(tx, orderId, timed);

      const items = await timed("select order items", () =>
        tx.query.orderItems.findMany({
          where: eq(schema.orderItems.orderId, orderId),
          columns: { id: true },
        }),
      );
      if (!items.some((it) => it.id === itemId)) {
        throw new ServiceError("NOT_FOUND", "Order item not found", 404);
      }
      if (items.length <= 1) {
        throw new ServiceError(
          "BAD_REQUEST",
          "Cancel the order instead of removing its last item.",
          400,
        );
      }

      await timed("delete item", () =>
        tx.delete(schema.orderItems).where(eq(schema.orderItems.id, itemId)),
      );

      return recalcOrderAndBill(tx, orderId, bill, timed);
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
    );

    this.events.orderStatusUpdate(dto, originSocketId);
    return dto;
  }
}

export const orderService = new OrderService();
