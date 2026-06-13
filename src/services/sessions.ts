import { and, eq, inArray, ne } from "drizzle-orm";

import { db, schema } from "@/db";
import { loadOrderDTO } from "@/lib/orders";
import { getBlockingReservation } from "@/lib/reservations";
import { makeTimer } from "@/lib/utils";
import type { SessionCreateInput, SessionMoveInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";
import {
  socketEvents,
  type EventPublisher,
  type Origin,
} from "@/services/events";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = "active" | "closed";

export type SessionAccessResult =
  | { valid: false; reason: "not_found" | "expired" }
  | { valid: false; reason: "moved"; tableNumber: string }
  | {
      valid: true;
      session: { id: string; status: Status };
      tableId: string;
    };

// Raised inside a transaction when the target table got taken between the
// pre-check and the row updates (a concurrent walk-in, order, or move).
class TargetTakenError extends Error {}
// Raised inside the cancel transaction when the session got closed (e.g. a
// concurrent payment) between the pre-check and the conditional update.
class AlreadyClosedError extends Error {}
// Raised when an order advanced to ready/served between the pre-check and the
// row updates — prepared food must go through payment, not cancellation.
class HasPreparedOrdersError extends Error {}

const targetTaken = () =>
  new ServiceError(
    "TABLE_OCCUPIED",
    "The target table was just taken — pick another table",
    409,
  );

export type MoveResult = {
  session: { id: string; tableId: string };
  table: { id: string; tableNumber: string };
};

export class SessionService {
  constructor(private readonly events: EventPublisher = socketEvents) {}

  /** Most recent session for a table in the given status (active by default). */
  async getForTable(tableId: string, status: Status) {
    const timed = makeTimer(`sessions GET ${crypto.randomUUID().slice(0, 8)}`);
    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: and(
          eq(schema.tableSessions.tableId, tableId),
          eq(schema.tableSessions.status, status),
        ),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      }),
    );
    return session ?? null;
  }

  /**
   * Open (seat) a table. Reuses an existing active session if one is open
   * (`created: false`). A booked reservation blocks walk-ins from 60 min before
   * its time (overridable with confirmation) and hard-blocks once due; a seat
   * window running past a reservation also hard-blocks. Marks the table occupied.
   */
  async open(input: SessionCreateInput) {
    const scope = `sessions POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);

    // Reuse an existing active session if one is already open for this table.
    const existing = await timed("select active session", () =>
      db.query.tableSessions.findFirst({
        where: and(
          eq(schema.tableSessions.tableId, input.tableId),
          eq(schema.tableSessions.status, "active"),
        ),
      }),
    );
    if (existing) return { session: existing, created: false };

    const blocking = await timed("check blocking reservation", () =>
      getBlockingReservation(input.tableId, {
        expectedLeaveAt: input.expectedLeaveAt ?? null,
      }),
    );
    if (blocking && (blocking.phase !== "buffer" || !input.overrideReservation)) {
      const r = blocking.reservation;
      throw new ServiceError(
        "TABLE_RESERVED",
        blocking.phase === "overlap"
          ? `Expected leave time overlaps the reservation for ${r.customerName} at ${r.reservedFor.toISOString()} — shorten the turnover or pick another table`
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

    const txStart = performance.now();
    const session = await db.transaction(async (tx) => {
      const [s] = await timed("insert session", () =>
        tx
          .insert(schema.tableSessions)
          .values({
            branchId: input.branchId,
            tableId: input.tableId,
            partySize: input.partySize ?? null,
            seatedAt: input.seatedAt ?? new Date(),
            tableNote: input.tableNote || null,
            customerName: input.customerName || null,
            customerPhone: input.customerPhone || null,
            expectedLeaveAt: input.expectedLeaveAt ?? null,
          })
          .returning(),
      );
      await timed("update table occupied", () =>
        tx
          .update(schema.tables)
          .set({ status: "occupied" })
          .where(eq(schema.tables.id, input.tableId)),
      );
      return s;
    });
    console.log(
      `[${scope}] transaction total: ${(performance.now() - txStart).toFixed(1)}ms`,
    );

    return { session, created: true };
  }

  /**
   * Validate a customer's order link: the `sessionId` must belong to an *active*
   * session for the given branch + table number. Returns a `valid:false` result
   * (with a reason) rather than throwing, so the client renders a friendly
   * screen instead of handling an error status.
   */
  async checkAccess(opts: {
    branchId: string;
    tableNo: string;
    sessionId: string | null;
  }): Promise<SessionAccessResult> {
    const timed = makeTimer(`session-access GET ${crypto.randomUUID().slice(0, 8)}`);

    const table = await timed("select table", () =>
      db.query.tables.findFirst({
        where: and(
          eq(schema.tables.branchId, opts.branchId),
          eq(schema.tables.tableNumber, opts.tableNo),
        ),
        columns: { id: true },
      }),
    );
    if (!table) return { valid: false, reason: "not_found" };

    const sessionId = opts.sessionId;
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return { valid: false, reason: "not_found" };
    }

    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, sessionId),
        columns: { id: true, branchId: true, tableId: true, status: true },
        with: { table: { columns: { tableNumber: true } } },
      }),
    );
    if (!session || session.branchId !== opts.branchId) {
      return { valid: false, reason: "not_found" };
    }
    if (session.status !== "active") return { valid: false, reason: "expired" };
    if (session.tableId !== table.id) {
      // Staff moved this session to another table — point the client at it so
      // an old link (or a device that missed the live event) still recovers.
      return {
        valid: false,
        reason: "moved",
        tableNumber: session.table.tableNumber,
      };
    }

    return {
      valid: true,
      session: { id: session.id, status: session.status },
      tableId: table.id,
    };
  }

  /**
   * Move an active table session — and every order in it — to another free
   * table in the same branch. The bill follows automatically (keyed by
   * session). The target must be available, free of an active session, and free
   * of a blocking reservation (buffer-window bookings can be overridden). Emits
   * `table:moved` after commit.
   */
  async move(
    sessionId: string,
    input: SessionMoveInput,
    { originSocketId }: Origin = {},
  ): Promise<MoveResult> {
    const timed = makeTimer(
      `session-move POST ${sessionId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, sessionId),
        with: { table: { columns: { id: true, tableNumber: true } } },
      }),
    );
    if (!session) throw new ServiceError("NOT_FOUND", "Session not found", 404);
    if (session.status !== "active") {
      throw new ServiceError(
        "SESSION_NOT_ACTIVE",
        "Only an active session can be moved",
        400,
      );
    }
    if (session.tableId === input.targetTableId) {
      throw new ServiceError(
        "BAD_REQUEST",
        "The session is already on this table",
        400,
      );
    }

    const target = await timed("select target table", () =>
      db.query.tables.findFirst({
        where: eq(schema.tables.id, input.targetTableId),
        columns: { id: true, branchId: true, tableNumber: true, status: true },
      }),
    );
    if (!target) throw new ServiceError("NOT_FOUND", "Target table not found", 404);
    if (target.branchId !== session.branchId) {
      throw new ServiceError(
        "BAD_REQUEST",
        "Target table belongs to a different branch",
        400,
      );
    }
    if (target.status === "occupied") {
      throw new ServiceError(
        "TABLE_OCCUPIED",
        `Table ${target.tableNumber} already has guests`,
        409,
      );
    }

    // Same gate as opening a table: a due reservation hard-blocks; one inside
    // the pre-arrival buffer needs explicit staff confirmation. The session's
    // planned leave time keeps the overlap rule intact on the new table.
    const blocking = await timed("check blocking reservation", () =>
      getBlockingReservation(input.targetTableId, {
        expectedLeaveAt: session.expectedLeaveAt,
      }),
    );
    if (blocking && (blocking.phase !== "buffer" || !input.overrideReservation)) {
      const r = blocking.reservation;
      throw new ServiceError(
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
    try {
      await db.transaction(async (tx) => {
        // Claim the target inside the transaction: the conditional update only
        // wins if the table is still free, closing the pre-check race.
        const claimed = await timed("claim target table", () =>
          tx
            .update(schema.tables)
            .set({ status: "occupied" })
            .where(
              and(
                eq(schema.tables.id, input.targetTableId),
                eq(schema.tables.status, target.status),
              ),
            )
            .returning({ id: schema.tables.id }),
        );
        if (claimed.length === 0) throw new TargetTakenError();
        const activeOnTarget = await timed("re-check target session", () =>
          tx.query.tableSessions.findFirst({
            where: and(
              eq(schema.tableSessions.tableId, input.targetTableId),
              eq(schema.tableSessions.status, "active"),
            ),
            columns: { id: true },
          }),
        );
        if (activeOnTarget) throw new TargetTakenError();

        await timed("move session", () =>
          tx
            .update(schema.tableSessions)
            .set({ tableId: input.targetTableId })
            .where(eq(schema.tableSessions.id, sessionId)),
        );
        // orders.tableId is denormalized — keep KDS/floor tickets pointing at
        // the new table.
        await timed("move orders", () =>
          tx
            .update(schema.orders)
            .set({ tableId: input.targetTableId })
            .where(eq(schema.orders.tableSessionId, sessionId)),
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
    } catch (err) {
      if (err instanceof TargetTakenError) throw targetTaken();
      throw err;
    }
    console.log(
      `[session-move ${sessionId.slice(0, 8)}] transaction total: ${(
        performance.now() - txStart
      ).toFixed(1)}ms`,
    );

    this.events.tableMoved(
      {
        branchId: session.branchId,
        sessionId,
        fromTableId,
        fromTableNumber: session.table.tableNumber,
        toTableId: target.id,
        toTableNumber: target.tableNumber,
      },
      originSocketId,
    );

    return {
      session: { id: sessionId, tableId: target.id },
      table: { id: target.id, tableNumber: target.tableNumber },
    };
  }

  /**
   * Cancel a table session without payment — for tables opened by mistake or
   * guests who left before ordering. Pending/preparing orders are cancelled with
   * the session; once any order is ready/served/completed the table must be
   * settled through POS instead. The unpaid bill row (if any) is removed, the
   * session closes, and the table frees up. Emits `order:status-update` per
   * cancelled order and `session:cancelled` after commit.
   */
  async cancel(
    sessionId: string,
    reason: string | null,
    { originSocketId }: Origin = {},
  ): Promise<{
    session: { id: string; status: "closed" };
    cancelledOrderIds: string[];
  }> {
    const timed = makeTimer(
      `session-cancel POST ${sessionId.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const session = await timed("select session", () =>
      db.query.tableSessions.findFirst({
        where: eq(schema.tableSessions.id, sessionId),
        with: { table: { columns: { tableNumber: true } } },
      }),
    );
    if (!session) throw new ServiceError("NOT_FOUND", "Session not found", 404);
    if (session.status !== "active") {
      throw new ServiceError(
        "SESSION_NOT_ACTIVE",
        "Only an active session can be cancelled",
        400,
      );
    }

    const sessionOrders = await timed("select orders", () =>
      db.query.orders.findMany({
        where: eq(schema.orders.tableSessionId, sessionId),
        columns: { id: true, status: true },
      }),
    );
    if (
      sessionOrders.some((o) =>
        ["ready", "served", "completed"].includes(o.status),
      )
    ) {
      throw new ServiceError(
        "SESSION_HAS_SERVED_ORDERS",
        "Some orders are already prepared or served — take payment instead",
        409,
      );
    }

    // A requested bill does not block: staff cancelling the table overrides the
    // customer's check request. Paid implies closed, but guard anyway.
    const bill = await timed("select bill", () =>
      db.query.bills.findFirst({
        where: eq(schema.bills.tableSessionId, sessionId),
        columns: { status: true },
      }),
    );
    if (bill?.status === "paid") {
      throw new ServiceError(
        "BILL_LOCKED",
        "The bill for this table is already paid",
        409,
      );
    }

    let cancelledOrderIds: string[] = [];
    const txStart = performance.now();
    try {
      await db.transaction(async (tx) => {
        // Conditional close: only wins if the session is still active, closing
        // the race with a concurrent payment (which flips the same row).
        const closed = await timed("close session", () =>
          tx
            .update(schema.tableSessions)
            .set({ status: "closed", closedAt: new Date() })
            .where(
              and(
                eq(schema.tableSessions.id, sessionId),
                eq(schema.tableSessions.status, "active"),
              ),
            )
            .returning({ id: schema.tableSessions.id }),
        );
        if (closed.length === 0) throw new AlreadyClosedError();

        const cancelled = await timed("cancel orders", () =>
          tx
            .update(schema.orders)
            .set({
              status: "cancelled",
              cancelledAt: new Date(),
              cancelReason: reason ?? "Table cancelled",
            })
            .where(
              and(
                eq(schema.orders.tableSessionId, sessionId),
                inArray(schema.orders.status, ["pending", "preparing"]),
              ),
            )
            .returning({ id: schema.orders.id }),
        );
        cancelledOrderIds = cancelled.map((o) => o.id);

        // Re-verify: an order may have advanced to ready between the pre-check
        // and the update above. Any non-cancelled order aborts the cancel.
        const remaining = await timed("re-check orders", () =>
          tx.query.orders.findFirst({
            where: and(
              eq(schema.orders.tableSessionId, sessionId),
              ne(schema.orders.status, "cancelled"),
            ),
            columns: { id: true },
          }),
        );
        if (remaining) throw new HasPreparedOrdersError();

        // Drop the unpaid bill row — there is no "void" status and an unpaid
        // bill has no payments attached, so deleting keeps reports clean.
        await timed("delete unpaid bill", () =>
          tx
            .delete(schema.bills)
            .where(
              and(
                eq(schema.bills.tableSessionId, sessionId),
                ne(schema.bills.status, "paid"),
              ),
            ),
        );

        // Free the table. If it has a due reservation the periodic sweep flips
        // it back to reserved on the next tick.
        await timed("free table", () =>
          tx
            .update(schema.tables)
            .set({ status: "available" })
            .where(eq(schema.tables.id, session.tableId)),
        );
      });
    } catch (err) {
      if (err instanceof AlreadyClosedError) {
        throw new ServiceError(
          "SESSION_NOT_ACTIVE",
          "The table was just paid or closed",
          409,
        );
      }
      if (err instanceof HasPreparedOrdersError) {
        throw new ServiceError(
          "SESSION_HAS_SERVED_ORDERS",
          "Some orders are already prepared or served — take payment instead",
          409,
        );
      }
      throw err;
    }
    console.log(
      `[session-cancel ${sessionId.slice(0, 8)}] transaction total: ${(
        performance.now() - txStart
      ).toFixed(1)}ms`,
    );

    for (const orderId of cancelledOrderIds) {
      const dto = await timed("load order dto", () => loadOrderDTO(orderId));
      if (dto) this.events.orderStatusUpdate(dto, originSocketId);
    }
    this.events.sessionCancelled(
      {
        branchId: session.branchId,
        sessionId,
        tableId: session.tableId,
        tableNumber: session.table.tableNumber,
      },
      originSocketId,
    );

    return { session: { id: sessionId, status: "closed" }, cancelledOrderIds };
  }
}

export const sessionService = new SessionService();
