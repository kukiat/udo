import { and, asc, desc, eq, gt, gte, lt, lte, ne } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  getBlockingReservation,
  reservationWith,
  toReservationDTO,
} from "@/lib/reservations";
import { RESERVATION_CONFLICT_MIN } from "@/lib/reservations-shared";
import { emitReservationUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import type {
  ReservationCancelInput,
  ReservationCreateInput,
  ReservationSeatInput,
} from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export async function listReservations(opts: {
  branchId: string | null;
  tableId: string | null;
  filter: string;
  from: Date | null;
  to: Date | null;
  limit: number;
  offset: number;
}) {
  const timed = makeTimer(`reservations GET ${crypto.randomUUID().slice(0, 8)}`);

  const scope = and(
    opts.branchId ? eq(schema.reservations.branchId, opts.branchId) : undefined,
    opts.tableId ? eq(schema.reservations.tableId, opts.tableId) : undefined,
    opts.from ? gte(schema.reservations.reservedFor, opts.from) : undefined,
    opts.to ? lt(schema.reservations.reservedFor, opts.to) : undefined,
  );
  // upcoming = still booked; past = settled (seated/cancelled/no_show)
  const where =
    opts.filter === "upcoming"
      ? and(scope, eq(schema.reservations.status, "booked"))
      : opts.filter === "past"
        ? and(scope, ne(schema.reservations.status, "booked"))
        : scope;

  const rows = await timed("select reservations", () =>
    db.query.reservations.findMany({
      where,
      with: reservationWith,
      orderBy:
        opts.filter === "upcoming"
          ? [asc(schema.reservations.reservedFor)]
          : [desc(schema.reservations.reservedFor)],
      limit: opts.limit,
      offset: opts.offset,
    }),
  );

  return rows.map(toReservationDTO);
}

export async function createReservation(
  input: ReservationCreateInput,
  user: { id: string; name: string },
) {
  const timed = makeTimer(`reservations POST ${crypto.randomUUID().slice(0, 8)}`);

  const table = await timed("select table", () =>
    db.query.tables.findFirst({
      where: and(
        eq(schema.tables.id, input.tableId),
        eq(schema.tables.branchId, input.branchId),
      ),
    }),
  );
  if (!table) throw new ServiceError("NOT_FOUND", "Table not found", 404);

  // Reject a second booking too close to an existing one on the same table.
  const windowMs = RESERVATION_CONFLICT_MIN * 60_000;
  const conflict = await timed("check conflict", () =>
    db.query.reservations.findFirst({
      where: and(
        eq(schema.reservations.tableId, input.tableId),
        eq(schema.reservations.status, "booked"),
        gt(
          schema.reservations.reservedFor,
          new Date(input.reservedFor.getTime() - windowMs),
        ),
        lt(
          schema.reservations.reservedFor,
          new Date(input.reservedFor.getTime() + windowMs),
        ),
      ),
    }),
  );
  if (conflict) {
    throw new ServiceError(
      "BAD_REQUEST",
      `Table ${table.tableNumber} already has a reservation around that time (bookings must be ${RESERVATION_CONFLICT_MIN} min apart)`,
      400,
      {
        conflictReservationId: conflict.id,
        reservedFor: conflict.reservedFor.toISOString(),
      },
    );
  }

  const [created] = await timed("insert reservation", () =>
    db
      .insert(schema.reservations)
      .values({
        branchId: input.branchId,
        tableId: input.tableId,
        reservedById: user.id,
        customerName: input.customerName,
        customerPhone: input.customerPhone || null,
        partySize: input.partySize,
        note: input.note || null,
        reservedFor: input.reservedFor,
      })
      .returning(),
  );

  emitReservationUpdate(input.branchId);

  return toReservationDTO({
    ...created,
    table: { id: table.id, tableNumber: table.tableNumber },
    reservedBy: { id: user.id, name: user.name },
  });
}

/**
 * Seat a booked reservation: opens a table session seeded from the reservation
 * (overridable via the input) and marks the table occupied.
 */
export async function seatReservation(id: string, input: ReservationSeatInput) {
  const timed = makeTimer(
    `reservation seat ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  const reservation = await timed("select reservation", () =>
    db.query.reservations.findFirst({
      where: eq(schema.reservations.id, id),
      with: {
        table: { columns: { id: true, tableNumber: true } },
        reservedBy: { columns: { id: true, name: true } },
      },
    }),
  );
  if (!reservation) throw new ServiceError("NOT_FOUND", "Reservation not found", 404);
  if (reservation.status !== "booked") {
    throw new ServiceError(
      "BAD_REQUEST",
      `Reservation is already ${reservation.status} and cannot be seated`,
      400,
    );
  }

  const activeSession = await timed("select active session", () =>
    db.query.tableSessions.findFirst({
      where: and(
        eq(schema.tableSessions.tableId, reservation.tableId),
        eq(schema.tableSessions.status, "active"),
      ),
      columns: { id: true },
    }),
  );
  if (activeSession) {
    throw new ServiceError("BAD_REQUEST", "Table already has an active session", 400);
  }

  // The seat window must not run past the table's next booking. Only the
  // overlap phase blocks here — the next booking's pre-arrival buffer must not
  // prevent seating this reservation.
  if (input.expectedLeaveAt) {
    const blocking = await timed("check next reservation overlap", () =>
      getBlockingReservation(reservation.tableId, {
        expectedLeaveAt: input.expectedLeaveAt,
        excludeReservationId: id,
      }),
    );
    if (blocking?.phase === "overlap") {
      const r = blocking.reservation;
      throw new ServiceError(
        "TABLE_RESERVED",
        `Expected leave time overlaps the next reservation for ${r.customerName} at ${r.reservedFor.toISOString()} — shorten the turnover`,
        409,
        {
          reservationId: r.id,
          reservedFor: r.reservedFor.toISOString(),
          customerName: r.customerName,
          phase: blocking.phase,
        },
      );
    }
  }

  const { session, updated } = await db.transaction(async (tx) => {
    const [s] = await timed("insert session", () =>
      tx
        .insert(schema.tableSessions)
        .values({
          branchId: reservation.branchId,
          tableId: reservation.tableId,
          partySize: input.partySize ?? reservation.partySize,
          seatedAt: input.seatedAt ?? new Date(),
          tableNote: input.tableNote ?? reservation.note,
          customerName: input.customerName ?? reservation.customerName,
          customerPhone: input.customerPhone ?? reservation.customerPhone,
          expectedLeaveAt: input.expectedLeaveAt ?? null,
        })
        .returning(),
    );
    await timed("update table occupied", () =>
      tx
        .update(schema.tables)
        .set({ status: "occupied" })
        .where(eq(schema.tables.id, reservation.tableId)),
    );
    const [r] = await timed("mark reservation seated", () =>
      tx
        .update(schema.reservations)
        .set({ status: "seated", seatedAt: new Date(), sessionId: s.id })
        .where(eq(schema.reservations.id, id))
        .returning(),
    );
    return { session: s, updated: r };
  });

  emitReservationUpdate(reservation.branchId);

  return {
    session,
    reservation: toReservationDTO({
      ...updated,
      table: reservation.table,
      reservedBy: reservation.reservedBy,
    }),
  };
}

export async function cancelReservation(id: string, input: ReservationCancelInput) {
  const timed = makeTimer(
    `reservation cancel ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
  );

  const reservation = await timed("select reservation", () =>
    db.query.reservations.findFirst({
      where: eq(schema.reservations.id, id),
      with: {
        table: { columns: { id: true, tableNumber: true } },
        reservedBy: { columns: { id: true, name: true } },
      },
    }),
  );
  if (!reservation) throw new ServiceError("NOT_FOUND", "Reservation not found", 404);
  if (reservation.status !== "booked") {
    throw new ServiceError(
      "BAD_REQUEST",
      `Reservation is already ${reservation.status} and cannot be cancelled`,
      400,
    );
  }

  const updated = await db.transaction(async (tx) => {
    const [r] = await timed("update reservation", () =>
      tx
        .update(schema.reservations)
        .set({
          status: input.noShow ? "no_show" : "cancelled",
          cancelledAt: new Date(),
        })
        .where(eq(schema.reservations.id, id))
        .returning(),
    );

    // Free the table unless another booked reservation is already due for it.
    // Conditional on status='reserved' so an occupied table is never touched.
    const otherDue = await timed("select other due reservation", () =>
      tx.query.reservations.findFirst({
        where: and(
          eq(schema.reservations.tableId, reservation.tableId),
          eq(schema.reservations.status, "booked"),
          ne(schema.reservations.id, id),
          lte(schema.reservations.reservedFor, new Date()),
        ),
        columns: { id: true },
      }),
    );
    if (!otherDue) {
      await timed("free table", () =>
        tx
          .update(schema.tables)
          .set({ status: "available" })
          .where(
            and(
              eq(schema.tables.id, reservation.tableId),
              eq(schema.tables.status, "reserved"),
            ),
          ),
      );
    }
    return r;
  });

  emitReservationUpdate(reservation.branchId);

  return toReservationDTO({
    ...updated,
    table: reservation.table,
    reservedBy: reservation.reservedBy,
  });
}
