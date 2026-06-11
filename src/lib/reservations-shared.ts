// Reservation timing rules shared by server routes and client UI.
// Client-safe: no DB imports here.

/** Reservations may be made at most this many days ahead. */
export const RESERVATION_MAX_DAYS = 7;
/** "Open table" is blocked starting this many minutes before the reserved time. */
export const RESERVATION_BUFFER_MIN = 60;
/** Two booked reservations on the same table must be at least this far apart. */
export const RESERVATION_CONFLICT_MIN = 120;

export type ReservationBlockPhase = "due" | "buffer";

/**
 * Where `now` falls relative to a reservation:
 * - "due": at/after the reserved time (hard block, no override)
 * - "buffer": within RESERVATION_BUFFER_MIN before it (override with confirm)
 * - null: outside the blocking window
 */
export function reservationBlockPhase(
  reservedFor: string | Date,
  nowMs: number = Date.now(),
): ReservationBlockPhase | null {
  const at = new Date(reservedFor).getTime();
  if (nowMs >= at) return "due";
  if (nowMs >= at - RESERVATION_BUFFER_MIN * 60_000) return "buffer";
  return null;
}
