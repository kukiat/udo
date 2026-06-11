import { and, eq, lte, ne } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { toReservationDTO } from "@/lib/reservations";
import { emitReservationUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { reservationCancelSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, reservationCancelSchema);
    if (error) return error;

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
    if (!reservation) return notFound("Reservation not found");
    if (reservation.status !== "booked") {
      return badRequest(
        `Reservation is already ${reservation.status} and cannot be cancelled`,
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [r] = await timed("update reservation", () =>
        tx
          .update(schema.reservations)
          .set({
            status: data.noShow ? "no_show" : "cancelled",
            cancelledAt: new Date(),
          })
          .where(eq(schema.reservations.id, id))
          .returning(),
      );

      // Free the table unless another booked reservation is already due for
      // it. Conditional on status='reserved' so an occupied table is never
      // touched.
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

    return Response.json({
      reservation: toReservationDTO({
        ...updated,
        table: reservation.table,
        reservedBy: reservation.reservedBy,
      }),
    });
  } catch (err) {
    console.error("POST /api/reservations/[id]/cancel", err);
    return serverError();
  }
}
