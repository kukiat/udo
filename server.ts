import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { and, eq, lte } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  branchKdsRoom,
  branchRoom,
  emitReservationUpdate,
  setIO,
  tableRoom,
  type AppIOServer,
} from "@/lib/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const DEFAULT_MAX_KDS = 3;
const RESERVATION_SWEEP_MS = 30_000;

// Flip available tables to "reserved" once their booked reservation is due.
// Occupied tables are left alone — the reservation stays booked and a later
// tick picks it up after the table frees (bill paid). Idempotent: the table
// update is conditional on status='available'.
let sweepingReservations = false;
async function sweepDueReservations() {
  if (sweepingReservations) return;
  sweepingReservations = true;
  try {
    const due = await db.query.reservations.findMany({
      where: and(
        eq(schema.reservations.status, "booked"),
        lte(schema.reservations.reservedFor, new Date()),
      ),
      with: { table: { columns: { id: true, status: true } } },
    });

    const branchesToNotify = new Set<string>();
    const flippedTables = new Set<string>();
    for (const r of due) {
      if (r.table.status !== "available" || flippedTables.has(r.tableId))
        continue;
      const updated = await db
        .update(schema.tables)
        .set({ status: "reserved" })
        .where(
          and(
            eq(schema.tables.id, r.tableId),
            eq(schema.tables.status, "available"),
          ),
        )
        .returning({ id: schema.tables.id });
      if (updated.length > 0) {
        flippedTables.add(r.tableId);
        branchesToNotify.add(r.branchId);
      }
    }
    for (const branchId of branchesToNotify) emitReservationUpdate(branchId);
  } catch (err) {
    console.error("[reservation-sweep]", err);
  } finally {
    sweepingReservations = false;
  }
}

async function maxKdsScreens(branchId: string): Promise<number> {
  const branch = await db.query.branches.findFirst({
    where: eq(schema.branches.id, branchId),
    columns: { settings: true },
  });
  return branch?.settings?.maxKdsScreens ?? DEFAULT_MAX_KDS;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io: AppIOServer = new IOServer(httpServer, {
    cors: { origin: "*" },
  });
  setIO(io);

  setInterval(sweepDueReservations, RESERVATION_SWEEP_MS);
  void sweepDueReservations(); // catch up immediately on boot/restart

  io.on("connection", (socket) => {
    // Track which branch KDS room this socket joined, for disconnect cleanup.
    let joinedKdsBranch: string | undefined;

    const broadcastScreenCount = async (branchId: string) => {
      const room = io.sockets.adapter.rooms.get(branchKdsRoom(branchId));
      const count = room?.size ?? 0;
      io.to(branchKdsRoom(branchId)).emit("kds:screen-count", {
        branchId,
        count,
        max: await maxKdsScreens(branchId),
      });
    };

    socket.on("kds:join", async ({ branchId }) => {
      const max = await maxKdsScreens(branchId);
      const room = io.sockets.adapter.rooms.get(branchKdsRoom(branchId));
      const current = room?.size ?? 0;

      if (current >= max) {
        socket.emit("kds:reject", {
          reason: `Maximum of ${max} KDS screens already connected for this branch.`,
          max,
        });
        return;
      }

      socket.join(branchKdsRoom(branchId));
      joinedKdsBranch = branchId;
      await broadcastScreenCount(branchId);
    });

    // Floor staff (waitstaff) observe the whole branch — no connection limit.
    socket.on("branch:join", ({ branchId }) => {
      socket.join(branchRoom(branchId));
    });

    socket.on("table:join", ({ tableId }) => {
      socket.join(tableRoom(tableId));
    });

    socket.on("ping", (ack) => {
      ack?.();
    });

    socket.on("disconnect", async () => {
      if (joinedKdsBranch) {
        // Socket has already left the room by the time this fires; recount.
        await broadcastScreenCount(joinedKdsBranch);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
