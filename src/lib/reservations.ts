import { and, asc, eq, lte, ne } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  RESERVATION_BUFFER_MIN,
  reservationBlockPhase,
  type ReservationBlockPhase,
} from "@/lib/reservations-shared";
import type { ReservationDTO } from "@/types";

type ReservationRow = typeof schema.reservations.$inferSelect & {
  table?: { id: string; tableNumber: string } | null;
  reservedBy?: { id: string; name: string } | null;
};

/** Relation include for reservation queries that map to ReservationDTO. */
export const reservationWith = {
  table: { columns: { id: true, tableNumber: true } },
  reservedBy: { columns: { id: true, name: true } },
} as const;

export function toReservationDTO(r: ReservationRow): ReservationDTO {
  return {
    id: r.id,
    branchId: r.branchId,
    tableId: r.tableId,
    tableNumber: r.table?.tableNumber ?? "",
    status: r.status,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    partySize: r.partySize,
    note: r.note,
    reservedFor: r.reservedFor.toISOString(),
    reservedBy: r.reservedBy
      ? { id: r.reservedBy.id, name: r.reservedBy.name }
      : null,
    sessionId: r.sessionId,
    createdAt: r.createdAt.toISOString(),
    seatedAt: r.seatedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}

export type BlockingReservation = {
  reservation: typeof schema.reservations.$inferSelect;
  phase: ReservationBlockPhase;
};

/**
 * The earliest booked reservation that currently blocks opening this table:
 * one whose reserved time is due, within the pre-arrival buffer window, or
 * overlapped by the planned seat window (`expectedLeaveAt`).
 */
export async function getBlockingReservation(
  tableId: string,
  opts: {
    now?: Date;
    /** Planned leave time — any booked reservation before it overlaps. */
    expectedLeaveAt?: Date | null;
    /** Skip this reservation (the one being seated). */
    excludeReservationId?: string;
  } = {},
): Promise<BlockingReservation | null> {
  const now = opts.now ?? new Date();
  const leaveMs = opts.expectedLeaveAt?.getTime() ?? null;
  const horizon = new Date(
    Math.max(now.getTime() + RESERVATION_BUFFER_MIN * 60_000, leaveMs ?? 0),
  );
  const reservation = await db.query.reservations.findFirst({
    where: and(
      eq(schema.reservations.tableId, tableId),
      eq(schema.reservations.status, "booked"),
      lte(schema.reservations.reservedFor, horizon),
      opts.excludeReservationId
        ? ne(schema.reservations.id, opts.excludeReservationId)
        : undefined,
    ),
    orderBy: [asc(schema.reservations.reservedFor)],
  });
  if (!reservation) return null;
  const phase = reservationBlockPhase(
    reservation.reservedFor,
    now.getTime(),
    leaveMs,
  );
  return phase ? { reservation, phase } : null;
}
