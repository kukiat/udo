# Domain: Ordering

Order intake and the order lifecycle state machine — from customer placement
through kitchen progression to served/completed or cancelled.

## Purpose

Owns orders and their line items, enforces every status transition, and is the
domain that snapshots catalog prices at placement time so later menu edits
never change history.

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `orders` | `src/db/schema/order.ts` | `orderNumber`, status, type (`dine_in`/`take_away`), `totalAmount`, `tableSessionId`, `cancelledAt`/`cancelReason` |
| `order_items` | `src/db/schema/order.ts` | quantity, **`unitPrice` snapshot**, note |
| `order_item_options` | `src/db/schema/order.ts` | chosen options with **price snapshot** |

## API surface

| Endpoint | Behavior |
|----------|----------|
| `POST /api/orders` | place an order; auto-opens a `TableSession` if none active; emits `order:new` |
| `GET /api/orders` | by `tableId&status=active`, or by `branchId` with `active=true` (KDS set: pending/preparing/ready) or `statuses=a,b,c` CSV (waitstaff includes served) |
| `GET /api/orders/[id]` | single order DTO with items + options |
| `PATCH /api/orders/[id]/status` | advance/step-back status; validates the transition table; emits `order:status-update` |
| `PATCH /api/orders/[id]/items/[itemId]` | per-item status update |
| `POST /api/orders/[id]/cancel` | cancel with optional reason; staff may cancel `pending`/`preparing`, customers only `pending` |

## Key modules

- `src/services/orders.ts` — the write use cases: `placeOrder` (price
  snapshot + session auto-open + insert), `transitionOrder`, `cancelOrder`
- `src/lib/orders.ts` — the read/rules core of the domain:
  - `TRANSITIONS` / `canTransition` — the status machine
  - `canCancel` — cancellation window
  - `buildOrderDTO` / `loadOrderDTO` — the canonical order read model every
    other domain uses (Billing settlement, KDS board, waitstaff)
- `src/contexts/CartContext.tsx` — client cart (localStorage per
  `branchId:tableNo`), cleared on successful placement
- `src/lib/validation.ts` — order placement schema

## Business rules

- Status machine: `pending → preparing → ready → served → completed`, with
  one-step corrections backward (`preparing → pending`, `ready → preparing`).
  Cancellation only from `pending`/`preparing`. Invalid transitions → 400.
- `completed` is set by Billing settlement (served orders complete when the
  session is paid), not by KDS.
- Cancelled orders keep their rows (`cancelledAt`, `cancelReason`) but are
  excluded from bills (`computeSessionBill` filters them).
- Prices are frozen at placement: `order_items.unitPrice` and option prices
  copy the *effective branch price* of the moment.
- `totalAmount` per order is computed at placement and is the input to the
  session bill subtotal.

## Events (via Real-time)

- Emits `order:new` (placement) and `order:status-update` (status/cancel) to
  the branch KDS room, the branch floor room, and the customer's table room.

## Dependencies

- **Depends on:** Catalog (price/option lookup at placement), Floor & Tables
  (table + session; auto-open), Real-time (emits).
- **Depended on by:** Kitchen/KDS (board content), Billing & Payments
  (billable orders, completion on settle), Floor & Tables (move re-points
  orders), Reporting.
