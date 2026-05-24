import type { Server as IOServer } from "socket.io";

import type {
  ClientToServerEvents,
  OrderDTO,
  ServerToClientEvents,
} from "@/types";

export type AppIOServer = IOServer<ClientToServerEvents, ServerToClientEvents>;

// Room name helpers — keep the naming in one place.
export const branchKdsRoom = (branchId: string) => `branch-kds-${branchId}`;
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

/** Broadcast a newly placed order to all KDS screens in its branch. */
export function emitNewOrder(order: OrderDTO) {
  getIO()?.to(branchKdsRoom(order.branchId)).emit("order:new", order);
}

/** Broadcast an order status change to the branch KDS and the customer table. */
export function emitOrderStatusUpdate(order: OrderDTO) {
  const io = getIO();
  if (!io) return;
  io.to(branchKdsRoom(order.branchId)).emit("order:status-update", { order });
  io.to(tableRoom(order.tableId)).emit("order:status-update", { order });
}

/** Notify the customer's table that its bill has been settled. */
export function emitBillPaid(sessionId: string, tableId: string) {
  getIO()?.to(tableRoom(tableId)).emit("bill:paid", { sessionId, tableId });
}
