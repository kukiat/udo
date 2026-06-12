import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  notFound,
  parseBody,
  serverError,
} from "@/lib/api";
import { getBlockingReservation } from "@/lib/reservations";
import { emitTableMoved } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { sessionMoveSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

// Thrown inside the move transaction when the target table got taken between
// the pre-check and the row updates (e.g. a concurrent walk-in or order).
class TargetTakenError extends Error {}

/**
 * Move an active table session — and every order in it — to another table in
 * the same branch. The bill follows automatically (it is keyed by session).
 * The target must be free: available, no active session, and no reservation
 * that blocks seating (buffer-window bookings can be overridden, mirroring
 * the open-table flow).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, sessionMoveSchema);
    if (error) return error;

    const timed = makeTimer(
      `session-move POST ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, id),
        with: { table: { columns: { id: true, tableNumber: true } } },
      }),
    );
    if (!session) return notFound("Session not found");
    if (session.status !== "active") {
      return errorResponse(
        "SESSION_NOT_ACTIVE",
        "Only an active session can be moved",
        400,
      );
    }
    if (session.tableId === data.targetTableId) {
      return badRequest("The session is already on this table");
    }

    const target = await timed("select target table", () =>
      db.query.tables.findFirst({
        where: eq(schema.tables.id, data.targetTableId),
        columns: { id: true, branchId: true, tableNumber: true, status: true },
      }),
    );
    if (!target) return notFound("Target table not found");
    if (target.branchId !== session.branchId) {
      return badRequest("Target table belongs to a different branch");
    }
    if (target.status === "occupied") {
      return errorResponse(
        "TABLE_OCCUPIED",
        `Table ${target.tableNumber} already has guests`,
        409,
      );
    }

    // Same gate as opening a table: a due reservation hard-blocks; one inside
    // the pre-arrival buffer needs explicit staff confirmation. The session's
    // planned leave time keeps the overlap rule intact on the new table.
    const blocking = await timed("check blocking reservation", () =>
      getBlockingReservation(data.targetTableId, {
        expectedLeaveAt: session.expectedLeaveAt,
      }),
    );
    if (blocking && (blocking.phase !== "buffer" || !data.overrideReservation)) {
      const r = blocking.reservation;
      return errorResponse(
        "TABLE_RESERVED",
        blocking.phase === "overlap"
          ? `The session's expected leave time overlaps the reservation for ${r.customerName} at ${r.reservedFor.toISOString()} — pick another table`
          : `Table is reserved for ${r.customerName} at ${r.reservedFor.toISOString()}`,
        409,
        {
          reservationId: r.id,
          reservedFor: r.reservedFor.toISOString(),
          customerName: r.customerName,
          phase: blocking.phase,
        },
      );
    }

    const fromTableId = session.tableId;
    const txStart = performance.now();
    await db.transaction(async (tx) => {
      // Claim the target inside the transaction: the conditional update only
      // wins if the table is still free, closing the pre-check race.
      const claimed = await timed("claim target table", () =>
        tx
          .update(schema.tables)
          .set({ status: "occupied" })
          .where(
            and(
              eq(schema.tables.id, data.targetTableId),
              eq(schema.tables.status, target.status),
            ),
          )
          .returning({ id: schema.tables.id }),
      );
      if (claimed.length === 0) throw new TargetTakenError();
      const activeOnTarget = await timed("re-check target session", () =>
        tx.query.tableSessions.findFirst({
          where: and(
            eq(schema.tableSessions.tableId, data.targetTableId),
            eq(schema.tableSessions.status, "active"),
          ),
          columns: { id: true },
        }),
      );
      if (activeOnTarget) throw new TargetTakenError();

      await timed("move session", () =>
        tx
          .update(schema.tableSessions)
          .set({ tableId: data.targetTableId })
          .where(eq(schema.tableSessions.id, id)),
      );
      // orders.tableId is denormalized — keep KDS/floor tickets pointing at
      // the new table.
      await timed("move orders", () =>
        tx
          .update(schema.orders)
          .set({ tableId: data.targetTableId })
          .where(eq(schema.orders.tableSessionId, id)),
      );
      // Free the old table. If it has a due reservation the periodic sweep
      // flips it back to reserved on the next tick.
      await timed("free old table", () =>
        tx
          .update(schema.tables)
          .set({ status: "available" })
          .where(eq(schema.tables.id, fromTableId)),
      );
    });
    console.log(
      `[session-move ${id.slice(0, 8)}] transaction total: ${(
        performance.now() - txStart
      ).toFixed(1)}ms`,
    );

    emitTableMoved(
      {
        branchId: session.branchId,
        sessionId: id,
        fromTableId,
        fromTableNumber: session.table.tableNumber,
        toTableId: target.id,
        toTableNumber: target.tableNumber,
      },
      req.headers.get("x-rms-socket-id"),
    );

    return Response.json({
      session: { id, tableId: target.id },
      table: { id: target.id, tableNumber: target.tableNumber },
    });
  } catch (err) {
    if (err instanceof TargetTakenError) {
      return errorResponse(
        "TABLE_OCCUPIED",
        "The target table was just taken — pick another table",
        409,
      );
    }
    console.error("POST /api/sessions/[id]/move", err);
    return serverError();
  }
}
