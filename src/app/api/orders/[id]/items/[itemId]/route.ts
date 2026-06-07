import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  notFound,
  parseBody,
  serverError,
} from "@/lib/api";
import { buildOrderDTO } from "@/lib/orders";
import { emitOrderStatusUpdate } from "@/lib/socket";
import { calcTotals, makeTimer, type Timed } from "@/lib/utils";
import {
  orderItemDeleteSchema,
  orderItemUpdateSchema,
} from "@/lib/validation";
import type { OrderDTO } from "@/types";

type Params = { params: Promise<{ id: string; itemId: string }> };
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class BillLockedError extends Error {}
class NotFoundError extends Error {}
class NotPendingError extends Error {
  constructor(readonly status: string) {
    super(status);
  }
}
class LastItemError extends Error {}

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
  if (!order) throw new NotFoundError();
  if (order.status !== "pending") throw new NotPendingError(order.status);

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
  if (bill.status !== "open") throw new BillLockedError();

  return { id: bill.id, discount: bill.discount };
}

// Recompute the edited order's total and, when the table has an (already
// locked) bill, roll the new subtotal up into it. Loads everything needed to
// both recompute totals AND build the response DTO in one query, so the caller
// doesn't need a separate post-commit fetch.
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
            options: {
              with: { optionItem: { columns: { name: true } } },
            },
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
  if (!order) throw new NotFoundError("Order not found");

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

function itemEditError(err: unknown) {
  if (err instanceof NotFoundError) return notFound("Order item not found");
  if (err instanceof NotPendingError) {
    return badRequest(
      `Order items can only be edited while the order is pending. Current status: ${err.status}`,
    );
  }
  if (err instanceof BillLockedError) {
    return errorResponse(
      "BILL_LOCKED",
      "The check has been requested for this table. Please ask staff to reopen the bill before changing orders.",
      409,
    );
  }
  if (err instanceof LastItemError) {
    return badRequest("Cancel the order instead of removing its last item.");
  }
  return null;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    const { data, error } = await parseBody(req, orderItemUpdateSchema);
    if (error) return error;

    const scope = `order-item PATCH ${itemId.slice(0, 8)} ${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const dto = await db.transaction(async (tx) => {
      const bill = await lockEditableOrder(tx, id, timed);

      const updated = await timed("update item", () =>
        tx
          .update(schema.orderItems)
          .set({
            ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
            ...(data.note !== undefined ? { note: data.note } : {}),
          })
          .where(
            and(
              eq(schema.orderItems.id, itemId),
              eq(schema.orderItems.orderId, id),
            ),
          )
          .returning({ id: schema.orderItems.id }),
      );
      if (updated.length === 0) throw new NotFoundError();

      return recalcOrderAndBill(tx, id, bill, timed);
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(
        1,
      )}ms`,
    );

    emitOrderStatusUpdate(dto, req.headers.get("x-rms-socket-id"));
    return Response.json({ order: dto });
  } catch (err) {
    const response = itemEditError(err);
    if (response) return response;
    console.error("PATCH /api/orders/[id]/items/[itemId]", err);
    return serverError();
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    const { data, error } = await parseBody(req, orderItemDeleteSchema);
    if (error) return error;

    const scope = `order-item DELETE ${itemId.slice(0, 8)} ${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const timed = makeTimer(scope);
    const txStart = performance.now();
    const dto = await db.transaction(async (tx) => {
      const bill = await lockEditableOrder(tx, id, timed);

      const items = await timed("select order items", () =>
        tx.query.orderItems.findMany({
          where: eq(schema.orderItems.orderId, id),
          columns: { id: true },
        }),
      );
      if (!items.some((it) => it.id === itemId)) throw new NotFoundError();
      if (items.length <= 1) throw new LastItemError();

      await timed("delete item", () =>
        tx.delete(schema.orderItems).where(eq(schema.orderItems.id, itemId)),
      );

      return recalcOrderAndBill(tx, id, bill, timed);
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(
        1,
      )}ms`,
    );

    emitOrderStatusUpdate(dto, req.headers.get("x-rms-socket-id"));
    return Response.json({ order: dto, reason: data.reason });
  } catch (err) {
    const response = itemEditError(err);
    if (response) return response;
    console.error("DELETE /api/orders/[id]/items/[itemId]", err);
    return serverError();
  }
}
