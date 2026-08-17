# Plan: Phase C agents — Debtors Watch, Stock Cover, Doc Watch (three more eyes on the Price Watch skeleton)

Status: **approved by Josh 2026-08-17 ("continue with the rest of the fixes and build")** as Phase C of
`.ai/plan_demo_mvp_finch.md`, extended with Doc Watch per Josh's ask the same day: *"when a caterer
scans an invoice, or a wholesaler scans a market sheet, it'll brief 'Market sheet 0168 scanned this
morning. Here's where {{company}} spent the most'."*
Architect: Fable. Implementer: one Opus agent, in an isolated git worktree branch `feat/agents-phase-c`
(the W1–W5 chat waves run on `main` concurrently; keep file overlap to the append-only spots listed).

## Decision: separate agents, not Price Watch add-ons
Price Watch's contract is "series → threshold → finding"; a scan digest is "event → summary". Different
trigger (per-document, immediate) and different truth (no threshold — every scan gets a card). Sharing
`agent_findings` + the Brief is the whole point of the skeleton; sharing Price Watch's run loop is not.
Every agent below: pure `detect.ts` (unit-tested, no I/O) → `run.ts` (service-role, `.eq('org_id')`
on every query, idempotent via `dedupe_key`) → cron route copying `app/api/agents/price-watch/route.ts`
(Bearer `CRON_SECRET`, `maxDuration`, org allowlist) → `vercel.json` entry → `brief-display.ts` chip.

## Shared changes (append-only, small)
- Org allowlist: introduce `AGENTS_ORG_IDS` read by ALL agent routes, falling back to `PRICE_WATCH_ORG_IDS`
  (so Josh's existing Vercel var keeps working); helper `lib/platform/agents/org-allowlist.ts`. Price
  Watch route switches to the helper (behaviour identical when only the old var is set).
- `lib/platform/agent-findings.ts`: `evidence_refs` today are `documents.id`s and the resolver counts
  them as documents. Debtors/Stock evidence are `of_invoices` / `pp_stock_items`+`pp_movements` ids.
  Add an optional `evidence_kind` column? **No — no schema change.** Instead each agent stores in
  `dedupe_key`'s prefix its slug, and the resolver (`agent-findings.ts`) branches on `finding.agent`:
  `price_watch`/`doc_watch` → documents (as now); `debtors_watch` → count of `of_invoices` ids →
  noun "invoice(s)" with link to `/app/orderflow/invoices?customer=…`; `stock_cover` → "stock line"
  with link to `/app/procurepulse/stock`. Keep the "only say what you can prove" rule: unresolvable →
  `null`, clause dropped.
- `components/platform/brief/brief-display.ts`: chips for `debtors_watch` (label "Debtors", warning
  tone), `stock_cover` ("Stock", neutral), `doc_watch` ("Read overnight" / "Scanned", info tone).
- `app/api/agents/digest/route.ts`: subject/body must not say "Price Watch" when kinds are mixed;
  order by `rand_impact desc nulls last`, cap 5 (verify, adjust copy only).
- `.env.example`: `AGENTS_ORG_IDS`.

## C1 — Debtors Watch (`lib/platform/debtors-watch/`, agent slug `debtors_watch`)
Data: lift the pure "effective status / days overdue / outstanding" logic already in
`lib/ai/finch/orderflow-data.ts` (`overdueInvoices`, `outstandingByCustomer`, `effectiveInvoiceStatus`)
into `lib/platform/orderflow-debtors.ts` so chat tools and the agent share ONE definition (chat tools
re-import; no behaviour change — tests pin it). Detect (pure): per customer, `overdue = invoices whose
effective status is unpaid and due_date < today - 0`; finding when `max(daysOverdue) ≥ 30 and
outstanding ≥ R5,000` OR `count(overdue) ≥ 3`. Fields: `observation` = "{customer} is {N} days past
terms on {count} invoice(s) — R{outstanding} outstanding{, their longest ever if derivable from history
else omit}"; `rand_impact` = outstanding; `recommended_action` = "Send a statement and hold new orders
until paid" (text; drafts-only); `evidence_refs` = the overdue `of_invoices` ids; `dedupe_key` =
`debtors_watch:{customer_id}:{oldest_overdue_invoice_id}`. Resolve/auto-close: none in v1 (human
dismisses; note in implementation.md). Cron `/api/agents/debtors-watch` `50 3 * * *`. Expected on
Meridian after refresh: Northern Suburbs Supply R190,900 / 40 days; Swartland Trade Co.; Rooiberg
Function Services (+ whatever the seed's own June stragglers qualify — report them; don't tune the
threshold to hide real data).

## C2 — Stock Cover (`lib/platform/stock-cover/`, slug `stock_cover`)
Inputs: `pp_stock_items` (on_hand, avg_unit_price, name), `pp_stock_thresholds` (low_threshold),
`pp_movements` last 30 days. Detect (pure): (a) **low cover** — `on_hand <= low_threshold` (the
existing `stockStatus()` semantics — reuse the fn from `lib/platform/procurepulse*` if importable
without I/O) AND trailing 30-day consumption > 0 → days_of_cover = on_hand / (consumption/30) →
observation "{item} has ~{d} days of cover at last month's usage — {on_hand} on hand, threshold
{low_threshold}"; `rand_impact = null` (nothing at stake yet — say nothing); recommended action
"Reorder before {weekday}"; (b) **count variance** — sum of `count_adjustment` in 30 d ≤ −5 % of
absolute receipts in the same window → "Stock count wrote off {n} {unit} of {item} this month (−{pct}%
of what came in) — worth a look"; `rand_impact = |adjust| × avg_unit_price`. `evidence_refs` = [] (no
documents; the resolver branch renders "stock line" + link). `dedupe_key` = `stock_cover:{rule}:
{stock_item_id}:{iso-week}`. Cron `/api/agents/stock-cover` `55 3 * * *`. Expected on Meridian:
Cooking Oil (4×5L case) low (12 vs 16), Chicken Portions −12 %, Cheese Block −8 %.

## C3 — Doc Watch (`lib/platform/doc-watch/`, slug `doc_watch`) — Josh's ask
Purpose: every newly-read document gets a small, immediate card. Two triggers, one detector:
1. **Immediate**: in `app/api/ai/extract/route.ts`, after a successful extraction of an `invoice`,
   `statement`/market sheet, or `price_list`, call `docWatchForDocument(serviceSupabase, orgId,
   documentId)` inside Next's `after()` (read `node_modules/next/dist/docs/` first) so the card exists
   by the time the user looks at the Brief. Failure is logged, never surfaced.
2. **Nightly sweep** `/api/agents/doc-watch` `40 3 * * *`: documents `created_at` in the last 26 h
   with line items and no existing `doc_watch` finding (dedupe) — catches email/WhatsApp-ingested docs.
Detect (pure): input = one document's `extracted_data` (+ supplier name, org name). Output:
`observation` = for invoices "Invoice {number} from {supplier} read {this morning|overnight} — R{total}.
Biggest lines: {top 3 by amount as 'desc R x'}"; for statements/market sheets "Market sheet {number}
from {supplier} scanned {when} — {N} lines, R{total}. {org} spent the most on {top 3}"; for price lists
"{supplier}'s new price list read — {N} items{, {k} changed vs the last one if a prior list exists
else omit}". `rand_impact = null` (informational). `recommended_action = null`. `evidence_refs =
[document_id]`. `dedupe_key = doc_watch:{document_id}`. Status starts `new` but the Brief should NOT
count these toward "N things need your attention" — extend `fetchFindings`/`brief-display` with an
`informational` flag derived from `agent === 'doc_watch'` (or `rand_impact is null && agent in
INFO_AGENTS`) so the greeting says "3 things need your attention" and the doc cards render in a lighter
"Read this morning" band below them (design 1a's "✦ Overnight I read 12 new invoices…" line becomes
data-driven: count of doc_watch findings created since 00:00 SAST). Cards auto-resolve: a `doc_watch`
finding older than 48 h moves to History (computed at read time in `fetchFindings`, no cron).
Model use: **none** — pure templates over extracted numbers (cheapest possible; the numbers are the
value). Header note in the module: if a future version wants prose, use the Haiku tier only.

## Files
Create: `lib/platform/agents/org-allowlist.ts`; `lib/platform/orderflow-debtors.ts`;
`lib/platform/debtors-watch/{detect,run}.ts`; `lib/platform/stock-cover/{detect,run}.ts`;
`lib/platform/doc-watch/{detect,run}.ts`; `app/api/agents/{debtors-watch,stock-cover,doc-watch}/route.ts`;
tests `tests/debtors-watch-detect.test.ts`, `tests/stock-cover-detect.test.ts`,
`tests/doc-watch-detect.test.ts`, `tests/agent-findings-evidence.test.ts` (resolver branch, pure part).
Modify (append-only / minimal): `vercel.json`, `.env.example`, `lib/platform/agent-findings.ts`,
`components/platform/brief/brief-display.ts`, `app/api/agents/price-watch/route.ts` (allowlist helper),
`app/api/agents/digest/route.ts` (copy), `app/api/ai/extract/route.ts` (after() hook),
`lib/ai/finch/orderflow-data.ts` (re-import shared debtor fns), `lib/ai/finch/knowledge.ts` (BRIEF
knowledge: the three new agents, one paragraph each), `app/app/page.tsx` + `components/platform/brief/*`
ONLY for the informational band (coordinate: W2 on `main` also edits `app/app/page.tsx` for the
history view — keep this change small and clearly delimited; expect a trivial merge).
Do not touch: `lib/platform/price-watch/*`, `supabase/demo-*.sql`, `components/platform/shell/*`,
`app/api/ai/agent/*`, `FinchChatProvider`.

## Edge cases
- Customer with credit notes / partial payments → use the shared effective-status fn; never recompute.
- Stock line with zero consumption in 30 d → no cover finding (division by zero → skip, and "no usage"
  is not "about to run out").
- Doc with no line items / no total → Doc Watch emits nothing (say nothing).
- Re-extraction of the same document → same `dedupe_key`, no duplicate.
- Org allowlist empty → every route returns `{ok:true, ran:0}` like Price Watch.
- Digest with only informational findings → send nothing (`sent:0`), as today.

## Verification
`npx tsc --noEmit` · `npm test` (all + 4 new files) · `npm run build` · lint count unchanged ·
`node` dry-run of each detector against fixtures built from `supabase/demo-refresh-2026-08.sql`
values (report the expected Meridian findings verbatim in the final report). Commit per agent
(`agents(c1): debtors watch`, `agents(c2): stock cover`, `agents(c3): doc watch`, `agents: shared
allowlist + evidence resolver + digest copy`) on branch `feat/agents-phase-c`; do not push; do not merge.
