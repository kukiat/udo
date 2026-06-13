# Domain: Floor & Tables

The physical floor: zones, tables and their layout, dining sessions
(seat → move → close/cancel), reservations, and the customer access gate.

## Purpose

Owns where guests sit and the lifecycle of a visit. A **table session** is the
unit a bill is keyed to — it groups every order placed during one seating.
Reservations block tables ahead of time and convert into sessions when seated.

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `floor_zones` | `src/db/schema/floor.ts` | named zones per branch, `sortOrder` |
| `tables` | `src/db/schema/table.ts` | `tableNumber` (unique per branch), status `available`/`occupied`, floor-plan geometry (`zoneId`, `posX`/`posY`, size, shape, seats, rotation) |
| `table_sessions` | `src/db/schema/table.ts` | status `active`/`closed`, party size, customer name/phone, `seatedAt`/`expectedLeaveAt`, table note |
| `reservations` | `src/db/schema/reservations.ts` | customer, party size, `reservedFor`, status (`booked`/seated/cancelled), `sessionId` set when seated, `reservedById` staff user |

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET /api/tables` · `PATCH /api/tables/[id]` · `POST /api/tables` | list, status/geometry update, add table |
| `PUT /api/tables/layout` | bulk-save floor-plan positions |
| `GET/POST/PUT/DELETE /api/floor-zones(/[id])` | zone CRUD |
| `POST /api/sessions` · `GET /api/sessions?tableId=X&status=active` | open a session (seat walk-in) / find the active session |
| `POST /api/sessions/[id]/move` | move an active session **and all its orders** to a free table in the same branch; bill follows (keyed by session); re-checks target inside the transaction (`TargetTakenError`) and respects blocking reservations |
| `POST /api/sessions/[id]/cancel` | close a session without payment; frees the table |
| `GET /api/sessions/access` | **public** capability check for customer order links: `sessionId` must be an *active* session for the given branch + table number; returns `valid: false` + reason instead of error statuses |
| `GET/POST /api/reservations` · `POST /api/reservations/[id]/seat` · `POST /api/reservations/[id]/cancel` | book (overlap/buffer checked), seat (opens a session, links `sessionId`), cancel |

## Key modules

- `src/services/sessions.ts` — `moveSession` and `cancelSession` (the atomic
  move/cancel transactions + their post-commit emits)
- `src/lib/reservations.ts` / `src/lib/reservations-shared.ts` —
  `getBlockingReservation`, overlap + buffer-window rules (buffer-window
  bookings can be explicitly overridden when seating/moving)
- `src/lib/order-link.ts` — customer order-link construction
- `src/components/session/` — session UI; `src/app/dashboard/[restaurantId]/floor-plan/page.tsx` — layout editor
- Waitstaff app (`src/app/waitstaff/[branchId]/`) is the main consumer UI

## Business rules

- One active session per table at a time; `tables.status` mirrors it
  (`occupied` ⇄ `available`).
- A session move is atomic: session row, all its orders' `tableId`, and both
  tables' statuses change in one transaction, then `emitTableMoved` notifies
  KDS, floor staff, and the customer's old table room.
- A reservation blocks seating on its table around `reservedFor`; seating a
  reservation creates the session and back-links it.
- Customer access is capability-based (branch + table number + active
  `sessionId`), not account-based.

## Events (via Real-time)

- Emits: `table:moved`, `session:cancelled`, `reservation:updated`.
- Session close on payment is **Billing's** job (`POST /api/payments`), not
  this domain's — Billing calls into session/table state inside its
  settlement transaction.

## Dependencies

- **Depends on:** Organization (branch scope), Identity & Access
  (`reservedById`; staff endpoints guarded), Real-time (emit helpers).
- **Depended on by:** Ordering (orders require a table + auto-open a session),
  Billing & Payments (bill per session; settlement closes the session and
  frees the table), Reporting.
