# Domain: Billing & Payments

Money: the session bill, taking payment (cash/card/QR), cashier shifts and
drawer reconciliation. Owns the settlement transaction — the single most
cross-domain write flow in the system.

## Purpose

Computes what a table owes (from non-cancelled orders + branch rates), records
payment against an open shift, and atomically ends the visit: bill paid,
session closed, table freed, served orders completed.

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `bills` | `src/db/schema/bill.ts` | one per `tableSessionId`: subtotal, vat, serviceCharge, discount, total, status `open`/`requested`/`paid` |
| `payments` | `src/db/schema/pos.ts` | method (cash/card/qr), amount, tendered/change for cash, `shiftId`, `cashierId` |
| `shifts` | `src/db/schema/pos.ts` | cashier till session: `openingFloat`, `closingAmount` at close, open/closed |

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET /api/bills?sessionId=X` | bill view for the session (customer bill page) |
| `POST /api/bills/request-check` | flip bill to `requested`; emits `bill:requested` to floor staff |
| `POST /api/payments` | **settlement** (see below) |
| `GET /api/shifts?branchId=X&status=open` | shifts with payment totals + expected drawer cash |
| `POST /api/shifts` | open shift (idempotent per cashier+branch; cashier from session) |
| `POST /api/shifts/[id]/close` | close with counted `closingAmount` + note |
| `GET /api/pos/sessions?branchId=X` | cashier worklist: active sessions with running totals + bill status |

## The settlement transaction (`settleSession`)

`settleSession()` in `src/services/payments.ts` (the `POST /api/payments`
route is a thin caller):

1. `computeSessionBill(sessionId, discount?)` recomputes totals from
   non-cancelled orders + branch rates (never trusts a stale bill row).
2. Cash guard: `tendered ≥ total` or 400.
3. Resolve shift: explicit `shiftId`, else the cashier's open shift.
4. **One `db.transaction`:** upsert bill as `paid` → insert payment (with
   tendered/change) → close the table session → free the table → mark the
   session's `served` orders `completed`.
5. After commit (best-effort): `order:status-update` per completed order +
   `bill:paid` to the table and branch rooms. Returns receipt data.

This flow is why the monolith stays a monolith — see the architecture
[README](../README.md), Rule 1. It is the canonical example of a cross-domain
orchestration kept atomic in one transaction.

## Key modules

- `src/services/payments.ts` — `settleSession` (the settlement use case above)
- `src/lib/bills.ts` — `computeSessionBill` (canonical bill read model:
  totals + line items; filters cancelled orders; reuses persisted discount
  when none given)
- `src/lib/utils.ts` — `calcTotals` (VAT/service-charge math from branch
  settings)
- `src/components/pos/` — ShiftBar, PaymentModal, Receipt;
  `src/app/pos/[branchId]/page.tsx` — cashier workspace

## Business rules

- A bill covers the whole table session (all orders in the seating);
  cancelled orders are excluded.
- Totals are always recomputed server-side at payment time; `discount` is the
  only operator-supplied figure.
- Expected drawer cash = `openingFloat` + cash payments of the shift;
  reconciliation compares it to the counted `closingAmount`.
- Payments survive shift/cashier deletion (`set null`) — money history is
  never orphaned.

## Events (via Real-time)

- Emits: `bill:requested` (customer asks for check), `bill:paid`,
  `order:status-update` (completion on settle).

## Dependencies

- **Depends on:** Ordering (billable orders, `loadOrderDTO`, completion),
  Floor & Tables (session/table state inside settlement), Organization
  (rates), Identity & Access (cashier attribution; POS guard), Real-time.
- **Depended on by:** Reporting (all sales analytics read from `payments`).
