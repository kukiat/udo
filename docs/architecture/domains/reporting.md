# Domain: Reporting

Read-only analytics over recorded payments, plus the Claude-powered "Ask
agent" chat that answers questions about the report on screen.

## Purpose

Turn Billing's payment records into sales insight: summaries, daily series,
payment-method breakdowns, category and top-item rankings. Owns **no tables**
— it is a pure read model over other domains' data, which is what keeps it
freely reshapeable.

## Owned data

None. Reads `payments` (+ joins through bills → sessions → orders → items →
menu items/categories) and never writes.

## API surface

| Endpoint | Behavior |
|----------|----------|
| `GET /api/reports/sales?branchId=X&from=&to=` | summary, by-day series, payment breakdown, by-category, top items — computed from recorded payments |
| `GET /api/reports/branch-sales` | cross-branch sales comparison (dashboard chart) |
| `POST /api/reports/agent` | "Ask agent": streams a Claude answer grounded on the SalesReport JSON the dashboard already fetched |

## The reports agent

`src/app/api/reports/agent/route.ts`:

- Guarded by `canAccess("reports", role)`; 503 with `AGENT_NOT_CONFIGURED`
  when `ANTHROPIC_API_KEY` is unset.
- The client sends the report JSON it is displaying + the conversation
  (≤40 messages); the route builds a grounding system prompt ("use the
  figures in the JSON, do not invent numbers") and streams plain text back.
- Model: `claude-opus-4-8`. The agent never queries the DB itself — its world
  is the report payload, which keeps it cheap and injection-resistant.

## Key modules

- `src/lib/reports.ts` — report builders (`computeSalesReport`,
  `computeBranchSalesReport`) + `resolveReportRange` (shared date/tz handling).
  `SalesReport` is the inferred return type the dashboard and agent share.
- `src/app/api/reports/(sales|branch-sales)/route.ts` — thin handlers: parse
  params → `resolveReportRange` → call builder → serialize
- `src/app/dashboard/[restaurantId]/reports/page.tsx` — analytics dashboard +
  agent chat UI

## Business rules

- Revenue = recorded **payments**, not order totals — unpaid/cancelled
  activity never counts as sales.
- Date filtering is payment-time based (`payments.createdAt`).
- Reports area access: owner/admin/branch_manager.

## Dependencies

- **Depends on:** Billing & Payments (source of truth), Ordering + Catalog
  (item/category dimensions), Organization (branch scope), Identity & Access
  (guard).
- **Depended on by:** nothing — terminal read model. This is the safest
  domain to evolve (or someday extract to a replica/warehouse) since nothing
  downstream consumes it.
