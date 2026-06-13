# Domain: Kitchen / KDS

The kitchen's real-time view of work: stations, the live order board, and the
per-branch screen limit.

## Purpose

Owns kitchen stations (routing tags for menu items) and the KDS experience:
a FIFO real-time board per branch with station filtering, status controls,
overdue alerts, and a hard cap on concurrent screens.

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `kds_stations` | `src/db/schema/kds.ts` | per branch: name (Hot Kitchen, Cold Kitchen, Drinks…), `sortOrder` |

The board itself is **not** persisted here — it is a live projection of
Ordering's data (`GET /api/orders?branchId=X&active=true` + socket events).

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET /api/kds-stations?branchId=X` | list stations (also consumed by the dashboard menu form and `RestaurantContext`) |

Status changes go through **Ordering's** endpoints
(`PATCH /api/orders/[id]/status`, `POST /api/orders/[id]/cancel`) — KDS owns
no order mutations of its own.

## Key modules

- `src/app/kds/[branchId]/page.tsx` — the board: initial fetch + socket
  updates, station filter tabs, FIFO sort, overdue highlighting (default
  15 min)
- `src/components/kds/` — `KdsOrderCard` etc.
- `server.ts` + `src/lib/socket.ts` — `kds:join` handling and the connection
  limit (see Real-time doc)

## Business rules

- **Connection limit:** on `kds:join` the server counts live sockets in the
  `branch-kds-{branchId}` room against `Branch.settings.maxKdsScreens`
  (default 3); at the cap the socket gets `kds:reject` and is disconnected.
  `kds:screen-count` keeps remaining screens' "Screen N of M" indicator live.
- Items route to stations via `menu_items.kdsStationId` (Catalog holds the
  tag; this domain defines the stations). The "All" tab shows everything.
- FIFO: oldest order first; cancelled orders drop off the board on their
  `order:status-update`.

## Events (via Real-time)

- Consumes: `order:new`, `order:status-update`, `table:moved` (re-labels
  tickets).
- Socket lifecycle events: `kds:join`, `kds:reject`, `kds:screen-count`.

## Dependencies

- **Depends on:** Ordering (board data + mutations), Organization
  (`maxKdsScreens`), Catalog (station tag on items), Identity & Access (area
  guard: owner/admin/branch_manager/kitchen_staff), Real-time.
- **Depended on by:** Catalog (`menu_items.kdsStationId` FK references
  stations).
