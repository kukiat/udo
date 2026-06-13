// Domain event port. Services depend on this interface, not on `@/lib/socket`
// directly, so a use case can be unit-tested with a fake publisher that records
// what was emitted. The default production implementation (`socketEvents`)
// delegates to the centralized Socket.IO helpers, keeping Rule 3 intact: the
// real-time instance (`getIO`) is still only ever touched inside `@/lib/socket`.
import {
  emitBillPaid,
  emitBillRequested,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitReservationUpdate,
  emitSessionCancelled,
  emitTableMoved,
} from "@/lib/socket";
import type {
  OrderDTO,
  SessionCancelledPayload,
  TableMovedPayload,
} from "@/types";

/**
 * Identifies the socket that triggered a mutation so the publisher can skip
 * echoing the event back to its originator. Threaded through service methods
 * that emit real-time updates.
 */
export type Origin = { originSocketId?: string | null };

/**
 * The set of real-time notifications domain services can raise. Methods mirror
 * the emit helpers in `@/lib/socket` (minus the `emit` prefix); all emits are
 * best-effort and fire after the transaction commits.
 */
export interface EventPublisher {
  /** A new order was placed — fan out to the branch KDS + floor screens. */
  newOrder(order: OrderDTO, originSocketId?: string | null): void;
  /** An order changed status — fan out to KDS, floor staff, and the table. */
  orderStatusUpdate(order: OrderDTO, originSocketId?: string | null): void;
  /** A session's bill was settled — notify the table + floor staff. */
  billPaid(branchId: string, sessionId: string, tableId: string): void;
  /** A table requested the check — notify floor staff. */
  billRequested(branchId: string, sessionId: string, tableId: string): void;
  /** Reservations changed for a branch — floor staff re-fetch. */
  reservationUpdate(branchId: string): void;
  /** An active session moved to another table. */
  tableMoved(payload: TableMovedPayload, originSocketId?: string | null): void;
  /** A session was cancelled without payment. */
  sessionCancelled(
    payload: SessionCancelledPayload,
    originSocketId?: string | null,
  ): void;
}

/**
 * Default publisher used in production. Each method forwards to the matching
 * `@/lib/socket` helper, which no-ops when no Socket.IO server is attached (so
 * services run unchanged in tests that don't inject a fake).
 */
export const socketEvents: EventPublisher = {
  newOrder: emitNewOrder,
  orderStatusUpdate: emitOrderStatusUpdate,
  billPaid: emitBillPaid,
  billRequested: emitBillRequested,
  reservationUpdate: emitReservationUpdate,
  tableMoved: emitTableMoved,
  sessionCancelled: emitSessionCancelled,
};
