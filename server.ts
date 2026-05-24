import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  branchKdsRoom,
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

    socket.on("table:join", ({ tableId }) => {
      socket.join(tableRoom(tableId));
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
