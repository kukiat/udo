import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, errorResponse, parseBody, serverError } from "@/lib/api";
import { loadOrderDTO } from "@/lib/orders";
import { emitNewOrder } from "@/lib/socket";
import { orderCreateSchema } from "@/lib/validation";

// Statuses still relevant to the kitchen.
const KDS_ACTIVE = ["pending", "preparing", "ready"] as const;

// Thrown inside the order transaction when the session's bill is no longer open.
class BillLockedError extends Error {}

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

    const rows = await db.query.orders.findMany({
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
    });

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

    // --- Snapshot prices from the DB (never trust client prices) -----------
    const menuItemIds = [...new Set(data.items.map((i) => i.menuItemId))];
    const allOptionIds = [
      ...new Set(data.items.flatMap((i) => i.optionItemIds ?? [])),
    ];

    const [menuItems, branchOverrides, optionItems] = await Promise.all([
      db.query.menuItems.findMany({
        where: inArray(schema.menuItems.id, menuItemIds),
      }),
      db.query.branchMenuItems.findMany({
        where: eq(schema.branchMenuItems.branchId, data.branchId),
      }),
      allOptionIds.length
        ? db.query.optionItems.findMany({
            where: inArray(schema.optionItems.id, allOptionIds),
          })
        : Promise.resolve([]),
    ]);

    const menuById = new Map(menuItems.map((m) => [m.id, m]));
    const overrideById = new Map(
      branchOverrides.map((o) => [o.menuItemId, o]),
    );
    const optionById = new Map(optionItems.map((o) => [o.id, o]));

    for (const item of data.items) {
      if (!menuById.has(item.menuItemId)) {
        return badRequest(`Unknown menu item: ${item.menuItemId}`);
      }
      const menu = menuById.get(item.menuItemId)!;
      const override = overrideById.get(item.menuItemId);
      if (
        menu.status !== "available" ||
        menu.deletedAt ||
        override?.isAvailable === false
      ) {
        return badRequest(`Menu item is not available: ${menu.name}`);
      }
      for (const oid of item.optionItemIds ?? []) {
        if (!optionById.has(oid)) {
          return badRequest(`Unknown option item: ${oid}`);
        }
      }
    }

    const orderId = await db.transaction(async (tx) => {
      // Get or create the active session for this table.
      let session = await tx.query.tableSessions.findFirst({
        where: and(
          eq(schema.tableSessions.tableId, data.tableId),
          eq(schema.tableSessions.status, "active"),
        ),
      });
      if (session) {
        // Once the check has been requested (or the bill is paid), the table is
        // closing out — no further items may be added.
        const bill = await tx.query.bills.findFirst({
          where: eq(schema.bills.tableSessionId, session.id),
          columns: { status: true },
        });
        if (bill && bill.status !== "open") {
          throw new BillLockedError();
        }
      }
      if (!session) {
        [session] = await tx
          .insert(schema.tableSessions)
          .values({ branchId: data.branchId, tableId: data.tableId })
          .returning();
        await tx
          .update(schema.tables)
          .set({ status: "occupied" })
          .where(eq(schema.tables.id, data.tableId));
      }

      // Sequential-ish order number, scoped to the branch.
      const countRows = await tx.query.orders.findMany({
        where: eq(schema.orders.branchId, data.branchId),
        columns: { id: true },
      });
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

      for (const item of data.items) {
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

      const [order] = await tx
        .insert(schema.orders)
        .values({
          branchId: data.branchId,
          tableId: data.tableId,
          tableSessionId: session.id,
          orderNumber,
          type: data.type,
          status: "pending",
          totalAmount: orderTotal.toFixed(2),
        })
        .returning();

      for (const row of itemRows) {
        const [orderItem] = await tx
          .insert(schema.orderItems)
          .values({
            orderId: order.id,
            menuItemId: row.menuItemId,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            note: row.note,
          })
          .returning();
        if (row.optionIds.length > 0) {
          await tx.insert(schema.orderItemOptions).values(
            row.optionIds.map((oid) => ({
              orderItemId: orderItem.id,
              optionItemId: oid,
              price: row.optionPrices.get(oid) ?? "0",
            })),
          );
        }
      }

      return order.id;
    });

    const dto = await loadOrderDTO(orderId);
    if (dto) emitNewOrder(dto);
    return Response.json({ order: dto }, { status: 201 });
  } catch (err) {
    if (err instanceof BillLockedError) {
      return errorResponse(
        "BILL_LOCKED",
        "The check has been requested for this table. Please ask staff to reopen the bill before ordering more.",
        409,
      );
    }
    console.error("POST /api/orders", err);
    return serverError();
  }
}
