"use client";

import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "@/types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | undefined;

/** Lazily create a single shared Socket.IO client connection. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
      // Same-origin connection to the custom Next.js server.
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
