"use client";

import { useEffect, useRef, useState } from "react";

import { getSocket, type AppSocket } from "@/lib/socket-client";
import type { ClientToServerEvents } from "@/types";

// The client→server events that join a room. `ping` is excluded — it's not a
// membership change and nothing needs to be replayed for it.
type RoomJoinEvent = "kds:join" | "branch:join" | "table:join";

// The payload for a given join event, taken straight from the socket contract
// so the hook stays in lock-step with `ClientToServerEvents`.
type JoinPayload<E extends RoomJoinEvent> = Parameters<ClientToServerEvents[E]>[0];

export type UseSocketRoomOptions<E extends RoomJoinEvent> = {
  /** Skip joining while prerequisites aren't met. Defaults to `true`. */
  enabled?: boolean;
  /**
   * Runs after every (re)join — use it for side effects that must repeat on
   * reconnect too, e.g. starting a latency probe or stamping a join time.
   */
  onJoin?: (socket: AppSocket, payload: JoinPayload<E>) => void;
};

/**
 * Join a Socket.IO room and — critically — **re-join on every reconnect**.
 *
 * socket.io restores the transport automatically after a drop, but our
 * app-level room membership (`kds:join` / `branch:join` / `table:join`) is not
 * part of that: the server forgets which rooms a socket was in. Without
 * re-emitting the join on `connect`, a client silently stops receiving room
 * broadcasts after any network blip. Centralizing the lifecycle here means no
 * caller can forget the re-join (the bug this hook was extracted to kill).
 *
 * Pass `payload = null` while prerequisites are still loading (e.g. a `tableId`
 * resolved from an async fetch); the hook waits, joins once it's ready, and
 * re-joins if the payload changes (e.g. the session moves to another table).
 *
 * @returns `{ connected }` — live transport state, for a status indicator.
 */
export function useSocketRoom<E extends RoomJoinEvent>(
  event: E,
  payload: JoinPayload<E> | null | undefined,
  options: UseSocketRoomOptions<E> = {},
): { connected: boolean } {
  const { enabled = true, onJoin } = options;
  const [connected, setConnected] = useState(false);

  // Keep the latest onJoin without making it an effect dependency, so callers
  // can pass an inline closure without forcing a re-subscribe every render.
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;

  // Serialize the payload so the effect re-runs only on a real value change,
  // not on a fresh object identity each render.
  const payloadKey = payload == null ? null : JSON.stringify(payload);

  useEffect(() => {
    if (!enabled || payload == null) {
      setConnected(false);
      return;
    }
    const socket = getSocket();

    const join = () => {
      setConnected(true);
      // socket.io's variadic emit can't prove the payload matches the event
      // when both are generic over the same union; `payload` was constructed
      // from the event's own parameter type, so the call is sound.
      (socket.emit as (event: E, payload: JoinPayload<E>) => void)(
        event,
        payload,
      );
      onJoinRef.current?.(socket, payload);
    };
    const onDisconnect = () => setConnected(false);

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", join);
      socket.off("disconnect", onDisconnect);
    };
    // `payloadKey` stands in for `payload`; `event`/`enabled` are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, enabled, payloadKey]);

  return { connected };
}
