# Domain: Real-time (Socket.IO)

Cross-cutting infrastructure, not a business domain: rooms, typed events, and
emit helpers. Documented like a domain because it has the strictest boundary
rule in the codebase — and because it is the planned first extraction seam
(architecture [README](../README.md), Rule 3).

## Purpose

Push state changes to the three live audiences — KDS screens, floor staff
(waitstaff), and customer devices — without polling. The database remains the
source of truth; every emit is a best-effort notification and clients re-fetch
on reconnect.

## Topology

The custom server (`server.ts`) hosts Socket.IO in the same Node process as
Next.js; route handlers reach the instance via `globalThis`
(`setIO`/`getIO` in `src/lib/socket.ts`).

Rooms (naming centralized in `src/lib/socket.ts`):

| Room | Audience | Notes |
|------|----------|-------|
| `branch-kds-{branchId}` | KDS screens | join via `kds:join`; capped at `Branch.settings.maxKdsScreens` (reject + disconnect at the cap; `kds:screen-count` broadcast on join/leave) |
| `branch-{branchId}` | floor staff (waitstaff) | uncapped |
| `table-{tableId}` | customer devices at a table | order status, bill, move/cancel follow-ups |

## Event catalog

Payloads are typed in `src/types` (`ClientToServerEvents` /
`ServerToClientEvents`); every server emit goes through a named helper in
`src/lib/socket.ts`.

| Event | Emit helper | Rooms | Emitted by |
|-------|-------------|-------|-----------|
| `order:new` | `emitNewOrder` | KDS + branch | Ordering (placement) |
| `order:status-update` | `emitOrderStatusUpdate` | KDS + branch + table | Ordering (status/cancel), Billing (completion on settle) |
| `bill:requested` | `emitBillRequested` | branch | Billing (request check) |
| `bill:paid` | `emitBillPaid` | table + branch | Billing (settlement) |
| `table:moved` | `emitTableMoved` | KDS + branch + old table | Floor & Tables (session move) |
| `session:cancelled` | `emitSessionCancelled` | branch + table | Floor & Tables |
| `reservation:updated` | `emitReservationUpdate` | branch | Floor & Tables (clients re-fetch) |
| `kds:join` / `kds:reject` / `kds:screen-count` | — (server lifecycle) | KDS | connection management in `server.ts` |

Helpers accept an `originSocketId` to skip echoing an event back to the
screen that caused it.

## Boundary rules

- **Never call `getIO()` outside `src/lib/socket.ts`.** Domain code uses the
  named emit helpers only.
- Adding an event = typed payload in `src/types` + one helper in `socket.ts`.
- Emit **after** the DB transaction commits, never inside it — an emit must
  never be able to announce a state that then rolls back.
- Emits are fire-and-forget; no business logic may depend on delivery.

## Extraction path (when scale demands)

This is the only stateful piece pinning the web tier to one process. The cut:

1. Run Socket.IO in its own process with the **Redis adapter**.
2. Swap the emit helpers' implementation to publish via Redis instead of the
   local instance — signatures unchanged, so no domain code moves.
3. Make the KDS connection count adapter-aware (`fetchSockets()` across
   nodes) so `maxKdsScreens` still holds cluster-wide.

## Key modules

- `src/lib/socket.ts` — rooms, emit helpers, instance sharing
- `server.ts` — Socket.IO server, `kds:join` + connection limit
- `src/lib/socket-client.ts` — browser-side client setup
- `src/types` — event/payload contracts
