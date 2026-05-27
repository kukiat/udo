import type { Server as IOServer } from "socket.io";

import type {
  ClientToServerEvents,
  OrderDTO,
  ServerToClientEvents,
} from "@/types";

export type AppIOServer = IOServer<ClientToServerEvents, ServerToClientEvents>;

// Room name helpers — keep the naming in one place.
export const branchKdsRoom = (branchId: string) => `branch-kds-${branchId}`;
// Branch-wide room for floor staff (waitstaff). Unlike the KDS room it has no
// connection limit — any number of waiter screens can observe the branch.
export const branchRoom = (branchId: string) => `branch-${branchId}`;
export const tableRoom = (tableId: string) => `table-${tableId}`;

// The custom server (server.ts) and the Next.js route handlers run in the same
// Node process, so we stash the Socket.IO instance on globalThis to share it.
const g = globalThis as unknown as { __rmsIO?: AppIOServer };

export function setIO(io: AppIOServer) {
  g.__rmsIO = io;
}

export function getIO(): AppIOServer | undefined {
  return g.__rmsIO;
}

/** Broadcast a newly placed order to all KDS + floor screens in its branch. */
export function emitNewOrder(order: OrderDTO) {
  const io = getIO();
  if (!io) return;
  io.to(branchKdsRoom(order.branchId)).emit("order:new", order);
  io.to(branchRoom(order.branchId)).emit("order:new", order);
}

/**
 * Broadcast an order status change to the branch KDS, the branch floor staff,
 * and the customer's table.
 */
export function emitOrderStatusUpdate(order: OrderDTO) {
  const io = getIO();
  if (!io) return;
  io.to(branchKdsRoom(order.branchId)).emit("order:status-update", { order });
  io.to(branchRoom(order.branchId)).emit("order:status-update", { order });
  io.to(tableRoom(order.tableId)).emit("order:status-update", { order });
}

/** Notify the customer's table and the branch floor staff that the bill is settled. */
export function emitBillPaid(branchId: string, sessionId: string, tableId: string) {
  const io = getIO();
  if (!io) return;
  io.to(tableRoom(tableId)).emit("bill:paid", { sessionId, tableId });
  io.to(branchRoom(branchId)).emit("bill:paid", { sessionId, tableId });
}

/** Notify the branch floor staff that a table has requested the check. */
export function emitBillRequested(
  branchId: string,
  sessionId: string,
  tableId: string,
) {
  const io = getIO();
  if (!io) return;
  io.to(branchRoom(branchId)).emit("bill:requested", { sessionId, tableId });
}
