# North star: Vyso as a fractional COO

Josh's directive (2026-08-13): the conversational interface (Brief + Finch) is
PRIMARY; modules become the backend. "Need an invoice? ask Finch. Tomatoes hitting
margin? ask Finch. Plan next month's margins? ask Finch. Fetch from Xero/Yoco? ask
Finch." Design guide: the imported Brief project (`.ai/design/vyso-brief/`) — elevate
the existing language, don't replace it.

## Why this is buildable here

The codebase already contains every load-bearing piece:
- **Finch tool registry** (`lib/ai/finch/tools.ts`): Anthropic-format tools, all
  running through the caller's RLS-scoped client, `canSeeMoney` finance gate,
  `workflow` tools gated to the Sonnet tier. OrderFlow tools exist and work
  (snapshot, invoices, orders, customers, `prepareOrderDraft` → FinchOrderPrefill).
- **The Brief** (shipped): findings feed + Finch chat with findings context.
- **agent_findings** (deployed): the shared sink every agent writes to.
- **Price Watch** (in flight): the first agent; blocked on Josh's re-extraction run.
- **Integrations**: Xero (tokens, webhooks, core lib) live; Gmail via ServiceDen;
  WhatsApp send. Yoco does not exist yet.
- **Standing guardrail (Josh's rule, org-wide)**: outbound anything is DRAFTS ONLY —
  a human clicks send. Applies to every phase below.

## Phases

### P0 — first agent live (IN FLIGHT)
Price Watch v1 per `.ai/plan_price_watch_agent.md`. Remaining: Josh runs the three
phase2 slices → backfill wave → detect/observe/run waves → crons. Exit: real
findings render in the Brief nightly.

### P1 — "Ask Finch anything" (read tools across the operation)
Extend the registry pattern (data fns + AgentTool entries + knowledge doc per module):
- margins/costing: price history (pw_price_points), item cost trends → "how are
  tomatoes impacting my margin?"
- docu: document lookup/search ("show me last week's Umgeni invoices")
- debtors: outstanding/overdue by customer (orderflow data, canSeeMoney-gated)
- planwise: current plan vs actuals reads
- xero: read-only fetches (balances, invoice status) via existing xero-core
- The 'brief' module's toolset (currently empty) gets the cross-module read set —
  the COO surface can answer about anything.
Exit: the four example questions answer correctly from live data in the Brief chat.

### P2 — "Ask Finch to act" (write/workflow tools, confirmation guardrails)
Per the registry's own design note; every write lands as a DRAFT or requires an
explicit in-chat confirmation card first:
- invoice/order draft for a client (extend prepareOrderDraft → invoice)
- draft supplier email from a Price Watch finding (ServiceDen Gmail infra) — this is
  the mock's "Draft supplier email" button, wired in both the card AND chat
- planwise scenario write ("plan margins for next month" → draft plan)
Exit: the Brief's finding cards grow their action buttons; nothing sends itself.

### P3 — more eyes (agents on the Price Watch skeleton)
Debtors watch (late payers — the mock's second card), reconciliation
(invoice-vs-delivery — third card), stock cover (fourth). Each: pure detect fns +
observe + cron, writing agent_findings. The Brief needs zero changes.

### P4 — reach
Yoco integration (new build: OAuth + read tools), deeper Xero actions (draft
invoices into Xero), WhatsApp digest, mobile companion (mock 1e), chat charts (1b).

## Standing constraints
- Drafts-only for all outbound. RLS-scoped reads everywhere; service role only in
  crons. Two-tier models (Haiku Q&A / stronger tier for workflows) per existing
  policy. Each phase ships behind the existing kill switches where applicable.
- Every phase gets its own plan_*.md + user approval before implementation, per
  Claude_Rules.
