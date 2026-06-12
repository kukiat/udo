import { and, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  notFound,
  parseBody,
  serverError,
} from "@/lib/api";
import { getBlockingReservation, toReservationDTO } from "@/lib/reservations";
import { emitReservationUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { reservationSeatSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/**
 * Seat a booked reservation: opens a table session seeded from the
 * reservation (overridable via the body) and marks the table occupied.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, reservationSeatSchema);
    if (error) return error;

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
    if (!reservation) return notFound("Reservation not found");
    if (reservation.status !== "booked") {
      return badRequest(
        `Reservation is already ${reservation.status} and cannot be seated`,
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
      return badRequest("Table already has an active session");
    }

    // The seat window must not run past the table's next booking. Only the
    // overlap phase blocks here — the next booking's pre-arrival buffer must
    // not prevent seating this reservation.
    if (data.expectedLeaveAt) {
      const blocking = await timed("check next reservation overlap", () =>
        getBlockingReservation(reservation.tableId, {
          expectedLeaveAt: data.expectedLeaveAt,
          excludeReservationId: id,
        }),
      );
      if (blocking?.phase === "overlap") {
        const r = blocking.reservation;
        return errorResponse(
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
            partySize: data.partySize ?? reservation.partySize,
            seatedAt: data.seatedAt ?? new Date(),
            tableNote: data.tableNote ?? reservation.note,
            customerName: data.customerName ?? reservation.customerName,
            customerPhone: data.customerPhone ?? reservation.customerPhone,
            expectedLeaveAt: data.expectedLeaveAt ?? null,
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

    return Response.json(
      {
        session,
        reservation: toReservationDTO({
          ...updated,
          table: reservation.table,
          reservedBy: reservation.reservedBy,
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/reservations/[id]/seat", err);
    return serverError();
  }
}
