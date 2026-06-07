import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { errorResponse, notFound, parseBody, serverError } from "@/lib/api";
import { emitBillRequested } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { billRequestSchema } from "@/lib/validation";

// Orders still in the kitchen pipeline — the check can't be requested until
// every order has at least been served.
const UNSERVED = ["pending", "preparing", "ready"] as const;

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, billRequestSchema);
    if (error) return error;

    const timed = makeTimer(
      `request-check POST ${crypto.randomUUID().slice(0, 8)}`,
    );

    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, data.sessionId),
        columns: { id: true, branchId: true, tableId: true },
      }),
    );
    if (!session) return notFound("Session not found");

    const unserved = await timed("select unserved order", () =>
      db.query.orders.findFirst({
        where: and(
          eq(schema.orders.tableSessionId, data.sessionId),
          inArray(schema.orders.status, [...UNSERVED]),
        ),
        columns: { id: true },
      }),
    );
    if (unserved) {
      return errorResponse(
        "ORDERS_NOT_SERVED",
        "Some orders haven’t been served yet. Please wait until all items arrive before requesting the check.",
        409,
      );
    }

    const existing = await timed("select bill", () =>
      db.query.bills.findFirst({
        where: eq(schema.bills.tableSessionId, data.sessionId),
      }),
    );

    let bill = existing;
    if (bill) {
      [bill] = await timed("update bill requested", () =>
        db
          .update(schema.bills)
          .set({ status: "requested" })
          .where(eq(schema.bills.id, bill!.id))
          .returning(),
      );
    } else {
      // No bill computed yet — create a placeholder in requested state.
      [bill] = await timed("insert bill requested", () =>
        db
          .insert(schema.bills)
          .values({ tableSessionId: data.sessionId, status: "requested" })
          .returning(),
      );
    }

    emitBillRequested(session.branchId, data.sessionId, session.tableId);

    return Response.json({ bill });
  } catch (err) {
    console.error("POST /api/bills/request-check", err);
    return serverError();
  }
}
