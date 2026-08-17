# Plan P1: "Ask Finch anything" — read tools across the operation

Approved as the next phase by Josh (2026-08-13, after P0). Parent:
`.ai/plan_fractional_coo.md`. Branch: `feat/ui-brief-reskin`. Read tools ONLY —
no writes, no sends. Every tool: RLS-scoped client, org-filtered, `canSeeMoney`
gate on anything financial, honest "no data yet" strings over empty guesses.

## Pattern (copy exactly from OrderFlow's existing implementation)

Per capability: data functions (like `lib/ai/finch/orderflow-data.ts` — thin,
typed, RLS reads) → `AgentTool` entries in `lib/ai/finch/tools.ts` under
`TOOLS_BY_MODULE` → knowledge-doc updates in `lib/ai/finch/knowledge.ts`.
Tool descriptions are written FOR the model: when to call, what it returns,
what it cannot answer. The `brief` module's toolset aggregates the cross-module
read set (the COO surface answers about anything).

## Waves

### P1.1 — documents + debtors (no P0 dependency) 
- `finch/docu-data.ts`: find documents (supplier/type/date-range/status filters,
  clamped limits), document summary (extracted fields + line count + flags — NOT
  raw base64/storage reads).
- Debtors (extends orderflow-data): outstanding by customer (total, oldest unpaid,
  days past terms — derived from of_invoices; inspect the actual orderflow schema
  for paid/issued fields and mirror how the UI computes outstanding), overdue list
  sorted by age. `canSeeMoney` gated.
- Register under `docu`, `orderflow`, and `brief` toolsets as fits; knowledge docs
  updated so the model knows the tools exist.

### P1.2 — price history + planwise reads
- Price/margin: series from `pw_price_points` (per supplier/item, latest vs 60-day
  median — reuse detect.ts helpers once P0 lands); honest "Price Watch hasn't
  backfilled yet" until rows exist.
- PlanWise: current plan vs actuals reads (inspect planwise-data.ts for the shapes
  the UI already computes; expose those, don't re-derive).

### P1.3 — Xero read tools
- Via existing `xero-core`: connection status, invoice/bill status lookups, balances
  as exposed by the current integration surface. Read-only; if the org has no Xero
  connection the tool says so. Inspect token/refresh handling — tools must not
  break the encrypted-token flow.

## Constraints
- No new dependencies; no route changes (the agent route's tool loop is generic).
- Workflow tier untouched (`workflow: true` reserved for P2).
- Rate limits and message clamps unchanged.
- Each wave: tsc/lint/test green + a live signed-in chat exercise of each new tool
  (or explicit note if auth blocks it), then architect review + commit.

## Exit criteria
The four example questions answer correctly in the Brief chat from live data:
invoices for a client (P1.1 lookup; drafting is P2), tomatoes→margin (P1.2),
margin plan reads (P1.2), Xero fetch (P1.3).
