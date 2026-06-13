import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, handleError, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { orderCreateSchema } from "@/lib/validation";
import { placeOrder } from "@/services/orders";

// Statuses still relevant to the kitchen.
const KDS_ACTIVE = ["pending", "preparing", "ready"] as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");
    const sessionId = searchParams.get("sessionId");
    const branchId = searchParams.get("branchId");
    const active = searchParams.get("active") === "true";
    // Optional explicit status filter (CSV), used alongside branchId.
    const statusesParam = searchParams
      .get("statuses")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) as (typeof schema.orders.$inferSelect)["status"][] | undefined;
    if (!tableId && !sessionId && !branchId) {
      return badRequest("tableId, sessionId, or branchId is required");
    }

    const timed = makeTimer(`orders GET ${crypto.randomUUID().slice(0, 8)}`);

    const where = sessionId
      ? eq(schema.orders.tableSessionId, sessionId)
      : branchId
        ? statusesParam && statusesParam.length > 0
          ? and(
              eq(schema.orders.branchId, branchId),
              inArray(schema.orders.status, statusesParam),
            )
          : active
            ? and(
                eq(schema.orders.branchId, branchId),
                inArray(schema.orders.status, [...KDS_ACTIVE]),
              )
            : eq(schema.orders.branchId, branchId)
        : eq(schema.orders.tableId, tableId!);

    const rows = await timed("select orders+items", () =>
      db.query.orders.findMany({
        where,
        orderBy: (o, { desc, asc }) =>
          branchId ? [asc(o.createdAt)] : [desc(o.createdAt)],
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

    const orders = rows.map((order) => ({
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
    }));

    return Response.json({ orders });
  } catch (err) {
    console.error("GET /api/orders", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, orderCreateSchema);
    if (error) return error;

    const order = await placeOrder(data, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/orders");
  }
}
