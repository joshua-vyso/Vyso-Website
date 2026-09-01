# PLAN.md — Vyso Restructure: from modular platform to a single-client ingestion & analysis tool

**Date:** 2026-08-31 · **Client:** Turn 'n Slice (fresh produce wholesaler, Johannesburg) · **Repo:** `Vyso Website` (Next.js 16 App Router, React 19, TS, Tailwind 4, Supabase RLS multi-tenant)

> Audit performed by 3 parallel Explore subagents (architecture/schema/auth · modules/chat/dead-weight · ingestion/design-system) per Claude_Rules.md; this plan synthesises their findings. No code was modified in the planning session.

## Context

Vyso today is a 9-module platform (Doc-U, OrderFlow, ProcurePulse, PricePilot, PlanWise, WasteWatch, ShiftBoard, SupplySync, InsightGen) plus a Finch chat assistant, an agent-findings Brief, and a mature multi-lane document-ingestion engine. It is being reshaped into a simplified data-ingestion-and-analysis tool for one client. The architecture (Next 16 + Supabase RLS + the `lib/platform/` data-access layer + the Doc-U extraction engine) stays as the backbone. The module system disappears from the UI. The design language (`--pf-*` tokens, existing component idiom) is kept. Chat is removed.

Target shape: **one global upload button → auto-categorisation → proposed entries → global review queue → committed entries**, with one-click reroute that reverses downstream committed entries, and correction learning. New IA: 7 pages (Stock & Suppliers, Sales & Customers, Fleet, Services & Expenses, Staff, Compliance, Documents) + Settings.

---

## Part 1 — Audit summary

### 1.1 Architecture map

- **Routing:** no route groups; one root layout (`app/layout.tsx`) serves 46 marketing pages *and* 113 platform pages (7 font families, marketing JSON-LD, and Lenis leak into `/app/*` and are worked around). Platform shell is `app/app/layout.tsx`: session guard → onboarding guard → `Promise.all` of 4 reads (findings, chats, plugins, review count) → `PlatformProvider → FinchChatProvider → [AppRail | main{TrialGate > ModuleLockGuard > children} | GlobalChatDock]`. Only one `'use client'` page in the whole platform tree (`app/app/docu/upload/page.tsx`).
- **Auth/tenancy:** `proxy.ts` refreshes cookies on `/app/*` only, never redirects. `getPlatformSession()` (`lib/platform/supabase-server.ts`, React-`cache()`d) resolves user → profile → org → features. **Live override:** `org_features` is read then overwritten all-true (`// TEMPORARY (testing)` loop) — entitlements are dead; `organisations.locked_modules` is the only live gate and is empty for every org. One org per user via `profiles.org_id`; roles `owner|admin|member` via `canSeeMoney`/`canSeeBrief` (`lib/platform/access.ts`). `TrialGate` still hard-locks on trial expiry.
- **Data flow:** zero server actions. Reads: Server Component → `lib/platform/<module>-data.ts` fetcher → `createServerSupabase()`; missing tables degrade to empty (`db-errors.ts`). Writes: client `fetch()` → 74 route handlers under `app/api/*`, resolving callers via `resolveUser()` (cookie or Bearer, mobile CORS) or `getPlatformSession()`. Service-role client (`supabase-service.ts`) used by webhooks/crons (25 files). Background work via Next `after()`. Realtime → `useRealtimeRefresh` → `router.refresh()`.
- **Schema:** two disconnected sources — `Vyso Platform/supabase/schema.sql` (base: organisations, profiles, documents, suppliers, pp_* core) and 69 loose hand-pasted SQL files in `Vyso Website/supabase/`. No migration runner. **11 tenant-carrying tables (incl. `documents`, `profiles`, `organisations`) have no checked-in DDL** (per `supabase/verify-rls-state.sql`); `documents` exists only as ~20 `ALTER TABLE` statements. **`demo-all-in-one.sql` (673 KB demo seed) is the only home of the `sb_*`, `ww_*`, PlanWise `pw_*`, `ig_*`, `ss_suppliers*` DDL.** Two RLS idioms coexist: base schema uses `current_org_id()`; all ~200 Website policies inline `org_id = (select p.org_id from profiles p where p.id = auth.uid())` — new work must use the inline idiom. `pw_` prefix collides between Price Watch (agent) and PlanWise (module). One storage bucket: `documents`.

### 1.2 Module inventory (condensed — see §2.1 for per-page reuse)

9 registry modules (`lib/platform/modules.ts`; the `Vyso Platform/shared/modules.ts` "canonical" copy is stale — do not sync from it) + ServiceDen (Vyso's own private outreach tooling, email-gated, 18 pages/19 routes/17 `sd_*` tables, not in the registry) + cross-cutting surfaces: The Brief (`app/app/page.tsx`, `agent_findings`, 7 nightly agent crons), plugins (Xero, Hubdoc), Core Data (`cd_*`), onboarding.

### 1.3 Ingestion pipeline (the future spine)

- **Entry points:** Doc-U upload page/bubble → `POST /api/ai/extract`; chat drop → same; OrderFlow order drop → `POST /api/ai/agent/ingest-document` → `ingestDocument`; Resend inbound email + Microsoft Graph webhook + reprocess → `ingestDocument({deferCommit})`. **No WhatsApp lane exists** (stale comments in `doc-watch/run.ts:13` claim otherwise).
- **Two divergent pipelines (must converge):** Path A `app/api/ai/extract/route.ts` re-implements routing locally, never calls `runDocumentSideEffects`, never runs `decideClassificationRouting`/amendment detection. Path B `lib/platform/document-ingest.ts ingestDocument` is the complete, gated pipeline. Path A is the one to retire.
- **Models:** Haiku (`claude-haiku-4-5`) classify/extract; Sonnet (`claude-sonnet-4-6`) order lane (with `gpt-5.6-luna` fallback provider); all env-overridable (`lib/ai/anthropic.ts:32-77`). Prompts in `anthropic.ts` + `lib/ai/order-prompt.ts`.
- **Types:** 10 canonical `DocumentType` values (`lib/platform/types.ts:44`): invoice, statement, delivery_note, price_list, order, expense_receipt, supplier_credit_note, customer_credit_request, customer_credit_note, payment_proof. Three hand-synced lists (`DocumentType`, `ExtractedDocType`, the prompt enum).
- **Confidence:** `coerceConfidence` (never fabricates 0), `finalizeExtractionConfidence` caps (needs_review→65, rotation→75), structure audit (`extraction-quality.ts`), arithmetic line audit (`line-audit.ts`), rotation recovery (`pdf-orientation.ts`), locale parsing (`locale-number.ts` — the single parser, verbatim `raw_*` strings).
- **Proposed→committed half-exists:** `deferCommit` + `approved_at`-as-claim-lock + status `pending/extracted → approved`; `runDocumentSideEffects` is the single commit gate (financial_only / amendment skips → order sync, or PP+SS feeds). Today only email defers; manual/chat uploads commit inline.
- **Reversal gap:** the only reversal is `unfeedDocumentFromProcurePulse` (called only by document delete). No OrderFlow un-sync, no SupplySync unfeed, no un-invoice. `TypePicker.tsx` — the current "reroute" — is a raw client-side `document_type` write with no reversal, no re-extraction, no side-effect re-run.
- **Correction learning (existing):** `cd_customer_item_aliases` (review-confirm learned), `cd_customer_uom_rules`, `pp_name_aliases`, `supplier_aliases` (+dismiss ruling), customer resolution ladder (`customer-match.ts`, read-only). No sender/vendor→domain routing rules yet.
- **Supersede:** `supersedes/superseded_by_document_id` columns + reprocess log; old rows retained. (Known follow-up: Graph *attachment* ids rotate on folder moves — supersede matching needs suffix/filename equivalence.)

### 1.4 Design system

- Platform tokens are **`--pf-*`** (+ `--tone-*`, `--dur-*`/`--ease-*`) in `app/globals.css:721-810` (Tailwind 4 CSS-first; no tailwind.config). A TS twin `lib/platform/tokens.ts` (`VYSO`, `STATUS_COLORS`) also exists. Adoption is partial — most module components hardcode the same hexes.
- Reusable as-is: `components/platform/module-ui.tsx` (ModuleHeader, Kpi/KpiStrip, Badge, SectionCard, DataTable, charts), `ui.tsx`, `SubNav`, `RouteSkeleton`, `AppIcon`/`VysoMark`, the `shell/` folder, `RoleGate`, `useGridNavigation`, `useRealtimeRefresh`.
- Duplication debt: 14 modal implementations, 5 button sets, 5 KPI cards, 3 empty-states, ~20 badges, per-module tables/tabs/charts — no `components/ui/` primitives layer exists (shadcn scaffolded in `components.json` but never generated).
- Highest-value logic to carry intact: the five review arms — `OrderReviewEditor` (83 KB), `ReceiptReviewCard`, `CreditReviewCard`, `AmendmentReviewCard`, `ExtractionEditor` — and their dispatcher `DocumentDetailPanel.tsx:321-371`. Their docblocks encode incident history.

### 1.5 Chat footprint (for removal)

~40 files delete outright (all of `components/platform/chat/`, `FinchChatProvider` 1356 lines, `GlobalChatDock`, `RailChats`, `finch-chats*.ts`, `finch-suggestions*.ts`, 13 chat-only `lib/ai/finch/*` files, 4 API routes, 7 test files, `finch_chats`/`finch_messages` tables) and ~20 files need edits (layout, Brief, shell, review-queue constants, OrdersView, onboarding StageData). **Blocker:** the human-approval Review surface lives at `/app/chat/review` — `components/platform/review/*` and its 3 API routes are otherwise live and must be rehomed before chat deletion. Keep from `lib/ai/finch/`: `config.ts`, `name-match.ts`, `order-handoff.ts`; relocate `orderflow-data.ts` (used by debtors agent) and `price-watch-data.ts` (used by price-watch agent).

### 1.6 Dead weight

`components/platform/vyso-ai/` + `lib/ai/vyso-agent/` (~2,140-line dead pre-Finch fork) · orphan components (`ComingSoon`, `ModuleSkeleton`, `DocumentsTable`, `CustomersManager`, `InvoicingView`, `ProductsManager`, `MarketingAuth`, `BriefChatPill`, `FinchBubble`) · orphan API routes (`/api/ai/message`, `/api/ai/agent/parse-order`, `/api/ai/agent/customers`, `/api/integrations/xero/status`) · unused deps (`clsx`/`tailwind-merge` via zero-call-site `lib/utils.ts`) · free-scan straggler `supabase/free-scan.sql` (untracked; a Vercel dashboard cron may still point at the deleted cleanup route) · dormant pay-gating (`org_features` override, `locked_modules` machinery, `StageModules` throwaway RPC call) · dir cruft (`desktop/` 804 MB Electron wrapper, `tmp/`, `Assets/`, 5 root PNGs) · stale docs (`AUDIT_FINDINGS.md`, `FABLE.md`, 94-entry `.ai/`).

---

## Part 2 — The Plan

### 2.1 Reuse map: the 7 pages + Settings

New route skeleton (all under the existing `app/app/` shell; each page = a `layout.tsx` with `SubNav` tabs, mirroring today's OrderFlow layout pattern):

| New page | Route | Tabs |
|---|---|---|
| Stock & Suppliers | `/app/stock` | dashboard · market-sheet · stock · suppliers · manufacturing · uploads |
| Sales & Customers | `/app/sales` | dashboard · orders · invoices · quotes · price-lists · customers |
| Fleet Management | `/app/fleet` | dashboard · activity · hub |
| Services & Expenses | `/app/expenses` | dashboard · activity · categories |
| Staff | `/app/staff` | dashboard · wages · leave · hub |
| Compliance | `/app/compliance` | dashboard · hub |
| Documents | `/app/documents` | (folder grid) |
| Review queue (global) | `/app/review` | (queue; linked from the shell, not a "page 8") |
| Settings | `/app/settings` | integrations · database-uploads · members |

`/app` itself redirects to `/app/stock` (see Open Question 1 re the Brief).

**Page 1 — Stock & Suppliers** (largest reuse)
- *Stock levels* ← ProcurePulse stock: `app/app/procurepulse/stock/*`, `components/platform/procurepulse/` (StockTable, ProductsOverview/Tabs, thresholds), `lib/platform/procurepulse*.ts`, all 12 `/api/procurepulse/*` routes, `pp_*` tables. Reuse as-is, rehomed + rethemed.
- *Suppliers + supplier credit notes* ← SupplySync: `app/app/suppliers/*`, `components/platform/supplysync/` (SupplierProfileDrawer, credits views), `lib/platform/supplysync-*.ts`, `ss_*` tables + `suppliers` + `supplier_aliases`. `supplier_credit_note` doc type + `CreditReviewCard` already exist.
- *Market sheet + supplier categorisation* ← adapt SupplySync pricing (`ss_supplier_pricing`, `/app/suppliers/pricing`) + `pp_item_suppliers` + Price Watch observations (`pw_price_points`). **Adapted, not as-is** — the "market sheet" daily-price view doesn't exist as a single surface; build it on `module-ui.tsx DataTable` over existing pricing data.
- *Manufacturing* ← ProcurePulse recipes/batches wholesale: `app/app/procurepulse/recipes/*`, `pp_recipes/pp_batches` tables, `BatchLogger` (strip its chat batch-confirm references).
- *Uploads / extraction-edit* ← Doc-U upload page (`app/app/docu/upload/page.tsx`, `useUploadBatch`, `UploadBubble`) + `ExtractionEditor` + `DocumentDetailPanel` and its five review arms. Reuse nearly as-is against the unified ingest endpoint (§2.2).

**Page 2 — Sales & Customers**
- *Orders & invoices* ← OrderFlow: `app/app/orderflow/{orders,invoices}/*`, `components/platform/orderflow/` (OrdersView, InvoicesViewV2, InvoiceDetailV2), `lib/platform/orderflow*.ts`, `of_*` tables, `syncOrderFromDocument`. **Conflict to resolve:** the spec's "orders = awaiting review, invoices = reviewed" requires an orders-awaiting-review queue that was *explicitly declined* earlier (reasoning recorded at `lib/platform/review-queue-shared.ts:109-117`; `of_orders.status='draft'` exists but nothing reads it as a queue). Also `syncOrderFromDocument` auto-invoices at confidence ≥80 with all lines priced — i.e. confident orders skip the "awaiting" state by design. Plan: keep auto-invoice (it is the TnS value prop), make the orders tab read `of_orders.status='draft'` + `needsCustomerReview` as the awaiting list, invoices tab = `status='invoiced'`.
- *Quotes* ← `of_quotes`/`of_quote_requests` + `QuoteReviewPane` + `/api/review/customer`. "Fed from the client's own website" needs a new inbound endpoint (Open Question 5).
- *Price lists* ← `of_settings`/`pl_price_lists` via existing `/app/orderflow/pricelists` + PricePilot's `pl_price_list_versions`/`pl_overrides` (`pl_rollback_version` RPC). Reuse the OrderFlow pricelists surface; PricePilot's analytics/targets/complaints UI is deleted.
- *Customer hub + customer credit notes* ← `of_customers` (29 learned/settings columns), `CustomersView`, `orderflow-crm.ts`, `orderflow-debtors.ts` (balance), `of_credit_notes` + `customer_credit_note`/`customer_credit_request` types + `CreditReviewCard`.

**Page 3 — Fleet Management** (all new UI + schema; reuse patterns)
- No fleet anything exists. Build `fl_vehicles` + `fl_activity` (§2.4), CRUD modelled on ShiftBoard's people pages (`shiftboard-write.ts` is the cleanest existing manual-entry write path). Auto-categorised fleet costs arrive via the spine: expense-class documents/bank-statement lines with `domain='fleet'` (correction rule: "this vendor is always fleet").

**Page 4 — Services & Expenses**
- The data lane exists (financial-only: `expense_receipt`, `payment_proof`, `business-effect.ts`, `ReceiptReviewCard`, `EXPENSE_CATEGORIES`) but has **no viewing UI today**. Build activity + categorised-expenditure views on `module-ui.tsx` primitives over a new committed-expenses table (§2.4). Reuse `ReceiptReviewCard` in the review queue as-is.

**Page 5 — Staff**
- *Staff hub / leave* ← ShiftBoard: `sb_employees`, `sb_leave_requests`, `sb_attendance`, `components/platform/shiftboard/` people/leave views, `shiftboard-data.ts`/`-write.ts`. Roster/live/insights/swaps UI is deleted; tables kept.
- *Wages + loans* ← new (`st_wage_entries`, `st_loan_entries`, §2.4); manual-entry forms modelled on ShiftBoard's write path. "Last paid" on the hub derives from wage entries.

**Page 6 — Compliance** (new, thin)
- New `cp_documents` table (§2.4) + manual-add flow reusing the upload spine with forced `domain='compliance'`. Hub = `DataTable` of filed docs with expiry columns.

**Page 7 — Documents**
- ← Doc-U folders: `document_folders`, `FolderGridView`, `DocumentTable`, `DocumentRowMenu`, signed-URL viewing (`app/app/docu/[id]/page.tsx`). Replace the free-form/type-based folders with **6 fixed domain folders** (matching pages 1-6) derived from `documents.domain`, with subfolders by `document_type` (credit notes, orders, invoices…). Doc-U's awaiting/confidence/flagged/recent/reconciliation pages are absorbed by the global review queue or deleted.

**Settings**
- *Integrations* ← `app/app/plugins/*` (Xero connect/sync/status, Hubdoc) as-is.
- *Database uploads* ← Core Data import wizard: `app/app/docu/databases/*`, `components/platform/coredata/ImportWizard.tsx` + `CsvImportModal`, `/api/import/{assist,parse-xlsx}` — reuse as-is, rehomed (covers customer lists, product lists).
- *Organisation members* ← `app/app/organisation/page.tsx` as-is.

**Forced-reuse flags (rebuild is honestly cheaper):**
- The per-module *dashboards* — don't adapt 7 old module dashboards; build one shared dashboard composition (KpiStrip + SectionCards + findings feed) and instantiate per page.
- PricePilot beyond price lists, PlanWise, WasteWatch, InsightGen UI — delete rather than adapt; nothing in the new IA wants them.
- `docu/DocuNav`, `procurepulse/PpSubnav` etc. — fold into the generic `SubNav` rather than porting the forks.

### 2.2 Ingestion spine design

The strategy is to **generalise the machinery that already works** (deferCommit, claim lock, `runDocumentSideEffects`, supersede, aliases) rather than build a parallel system.

**a) One pipeline.** Retire Path A: replace `POST /api/ai/extract` with `POST /api/ingest` built on `ingestDocument` (Path B), so every lane — global upload button, email, Graph, reprocess — gets classification routing, escalation, amendment detection, and the side-effect gate. `uploadDocument`/`useUploadBatch` (client) stay; only the endpoint changes. Chat and order-drop lanes disappear with chat.

**b) Domain layer.** Add `documents.domain` (`stock | sales | fleet | expenses | staff | compliance`), derived deterministically from `document_type` + counterparty direction (the `EFFECT_BY_TYPE`/`counterparty_role` logic already computes most of this), overridable by routing rules and by the reviewer. Domain drives: which page's data the doc feeds, which Documents folder it files into, and review-queue grouping.

**c) Proposed vs committed — make every lane defer.** Flip `deferCommit` to the default for all ingest lanes. Docs land as `status='extracted'` (proposed). Auto-commit remains for high-confidence docs (existing thresholds: doc ≥80, customer ≥80, priced lines) but *through the same gate*, so everything is uniformly reversible. New table `proposed_entries` materialises what a commit *will* do (per entry: target kind, payload, confidence) so the review queue can show and let users edit downstream effects — for most doc types this is derivable at review time from `extracted_data`; the table earns its keep for **bank statements**, where one document yields N independently-routed line entries.

**d) Effects ledger — the reversal index.** New table `document_effects` (org_id, document_id, target_table, target_id, effect kind, created_at), written by every side-effect writer (`syncOrderFromDocument`, `feedDocumentToProcurePulse`, `feedDocumentToSupplySync`, new expense/fleet/staff/compliance writers). Reversal = walk the ledger newest-first and undo. Build the missing reversers: `unsyncOrderFromDocument` (delete `of_order_items`/`of_orders`/linked `of_invoices` by `source_document_id`; model stock reversal on the existing reverse-then-reapply in `syncStock`; a consumed `of_next_number` invoice number is voided, not reused), `unfeedDocumentFromSupplySync`, plus the existing `unfeedDocumentFromProcurePulse`. `POST /api/documents/delete` switches to the ledger too.

**e) One-click reroute.** New `POST /api/documents/reroute {documentId, domain, document_type?}` replacing `TypePicker`'s raw client-side write (`components/platform/docu/TypePicker.tsx:33-39`): claim the doc (existing `claimDocumentForCommit` pattern) → reverse via the effects ledger → re-stamp domain/type → re-run extraction *only if* the new lane needs a different read (order lane ↔ generic) → re-propose → (auto-)commit through `runDocumentSideEffects`. Works on `approved` docs, which the current claim guard forbids — extend the guard with an explicit reroute arm.

**f) Global review queue at `/app/review`.** Rehome `components/platform/review/*` + `lib/platform/review-queue*.ts` + `/api/review/*` out of the chat shell. Queue = existing predicate (`status in ('extracted','pending','error')`, unclaimed, not superseded) grouped by domain, using the existing 7-pile `REVIEW_TASKS` recast as domain piles. Each item renders its existing review arm (`DocumentDetailPanel` dispatcher). Add the reroute control and, for bank statements, per-line accept/reroute. Shell surfaces a count badge (reuse `RailReview`).

**g) Correction learning.** Keep all four existing mechanisms. Add `routing_rules` (org_id, matcher_kind `supplier_name|sender_email|keyword`, matcher_value, target domain/document_type, source document_id, created_by) — written when a reviewer reroutes with "always do this", consulted in `decideClassificationRouting` *before* the model's answer is accepted ("this vendor is always fleet"). Supplier-name mappings continue through `supplier_aliases`.

**h) Bank statements.** New `document_type='bank_statement'` (widen `documents_document_type_check` — **verify by insert-probe**, PostgREST can't read pg_constraint and one prior widening silently failed) + new extraction prompt arm producing dated lines. Each line → a `proposed_entries` row classified to a domain (fleet fuel, staff wage, supplier payment, expense…) via routing rules + Haiku; the review queue shows the statement as an expandable group. Committing writes per-domain entries and ledger rows per line. `statement` (supplier statement) remains a separate type.

**i) Global upload button.** Top-right control mounted in the shell (`AppRail` header region + `MobileTopBar`), opening the existing upload tray (`useUploadBatch`) posting to `/api/ingest`. The Stock page's uploads tab shows history/status; the button itself is global chrome.

### 2.3 Deletion list

**Chat (prerequisite: review queue rehomed first — §2.2f):** everything in audit §1.5. Tables `finch_chats`/`finch_messages` dropped after export-or-ignore decision; `FINCH_ENABLED` env + `finchEnabled` session field removed. ⚠ `components/platform/onboarding/StageData.tsx` uses `useFinchStream` → rewire to plain fetch or drop the onboarding data stage.

**Module system UI:** `UnderTheHood`, `ModuleLockGuard`, `ModuleLockNotice`, `ComingSoon`, `moduleForPathname`/`railModules`/`firstOpenableModuleHref` (replace `shell-data.ts` with a static 7-page nav config), `SubNav` forks (`DocuNav`, `PpSubnav`, …), `module-widgets.ts`, `StageModules` module picker + `onboarding_choose_modules` RPC call, the `org_features` all-true override *and* its underlying reads, `locked_modules` reads in `review-queue.ts:211`, `supplysync-feed.ts:205-208`, `review-actions.ts moduleOpen()`. ⚠ Keep `MODULES`' route strings until the last old route is deleted — `ModuleLockGuard` prefix-matching dies with it. The old module routes themselves (`/app/orderflow` etc.) are deleted per phase as their replacements land, with redirects during transition.

**Whole modules with no home in the new IA (UI + lib deleted; tables retained initially):** PricePilot (except price-list versioning), PlanWise (`/app/marginview`), WasteWatch (`/app/wastelog`), InsightGen (`/app/reportgen`), ShiftBoard roster/live/insights/swaps. ⚠ **Do not drop `pw_`(PlanWise)/`ww_`/`ig_`/`sb_` swap tables in the same change** — InsightGen and PricePilot cross-read many tables; dropping is a later, verified cleanup.

**Dead code (safe, do first):** `vyso-ai`/`vyso-agent` fork, orphan components and API routes (audit §1.6 list), `lib/utils.ts` + `clsx`/`tailwind-merge` deps, stale WhatsApp comments, root/`Assets/` stray PNGs, `tmp/`, chat test files.

**Risky/needs Josh:** `desktop/` (804 MB Electron wrapper — delete?); `supabase/free-scan.sql` + possible Vercel dashboard cron + possible live `scan_*` tables and `free-scan` bucket in prod; ServiceDen (Open Question 3); The Brief + 7 agent crons (Open Question 1); marketing `/platform/modules/*` pages describing modules that will no longer exist (Open Question 4); mobile app (`Vyso Mobile`) which mirrors `MODULES` and calls the Bearer/CORS API routes (Open Question 6).

### 2.4 Schema changes

All as idempotent paste-into-SQL-editor scripts (the house convention), using the **inline RLS idiom** (`org_id = (select p.org_id from profiles p where p.id = auth.uid())`) + owner/admin write predicates where money-adjacent. Every constraint change verified by insert-probe.

**Step 0 (prerequisite):** write `supabase/canonical-documents.sql` — reference `CREATE TABLE IF NOT EXISTS` DDL for `documents` and the other 10 tables that exist only in the dashboard, so later migrations have a stated baseline.

New tables:
- `proposed_entries` — id, org_id, document_id, source_line_ref, domain, target_kind, payload jsonb, confidence, status (`proposed|committed|dismissed`), committed_at, created_at.
- `document_effects` — id, org_id, document_id, effect_kind, target_table, target_id, created_at (indexed by document_id).
- `routing_rules` — id, org_id, matcher_kind, matcher_value, target_domain, target_document_type, source_document_id, created_by, created_at; unique (org_id, matcher_kind, matcher_value).
- `fl_vehicles` — id, org_id, name, plate, make_model, licence_renewal_at, service_due_at, status, created_at.
- `fl_activity` — id, org_id, vehicle_id, kind (`service|fuel|repair|toll|other`), amount, currency, occurred_at, notes, document_id, source (`manual|document`), created_by.
- `ex_expenses` — id, org_id, category, description, amount, currency, occurred_at, supplier_id, document_id, source, created_by (the committed ledger the financial-only lane currently lacks).
- `st_wage_entries` — id, org_id, employee_id → `sb_employees`, period_start/end, gross_amount, paid_at, notes, created_by.
- `st_loan_entries` — id, org_id, employee_id, entry_date, amount, kind (`advance|repayment|adjustment`), notes, created_by (balance = sum).
- `cp_documents` — id, org_id, kind (text: BEE, food safety, …), title, filed_at, expires_at, document_id, notes, created_by.

Alters:
- `documents`: add `domain` text CHECK over the 6 domains (nullable during backfill), widen `documents_document_type_check` to include `bank_statement`.
- Backfill migration: stamp `domain` on existing rows from `document_type` + `counterparty_role` (SQL + one-off script; TnS live data — run after code deploy that writes it).
- Drop (late, separately): `finch_chats`, `finch_messages`; eventually unused module tables.

### 2.5 Build order

Adjusted from the intended order: a **Phase 0 shell/teardown phase is pulled forward**, because (a) chat removal is blocked on rehoming the review queue, (b) the global upload button and 7-page nav are shell work every page depends on, and (c) deleting dead weight first shrinks every later diff. Documents stays early (cheap once `domain` exists). Within the thin pages, Services & Expenses moves first (its data lane already exists), then Staff (tables exist), then Fleet and Compliance (all-new).

- **Phase 0 — Teardown & shell.** Dead-code deletions · canonical DDL script · rehome review queue to `/app/review` · remove chat · replace rail nav with the 7-page config + global upload button · remove module gating (`ModuleLockGuard`, `org_features` override, `locked_modules` reads) · `/app` → `/app/stock` redirect. Old module routes stay reachable but un-navigated during transition.
- **Phase 1 — Ingestion spine + Stock & Suppliers.** `/api/ingest` unification (retire `/api/ai/extract`) · `domain` column + backfill · `document_effects` + reversers (`unsyncOrderFromDocument`, SS unfeed) · reroute endpoint replacing `TypePicker` · `routing_rules` + learning hooks · all-lanes `deferCommit` with auto-commit thresholds · build `/app/stock` (stock, suppliers, market sheet, manufacturing, uploads tab) from ProcurePulse + SupplySync surfaces.
- **Phase 2 — Documents.** `/app/documents` domain-folder hub; retire Doc-U inbox/folder pages; keep `[id]` document viewer.
- **Phase 3 — Sales & Customers.** `/app/sales` from OrderFlow surfaces · orders-awaiting-review tab (`of_orders.status='draft'` + `needsCustomerReview`) · customer hub with balances (debtors logic) · quotes (+ website intake endpoint pending Open Q5) · price lists.
- **Phase 4 — Bank statements + Services & Expenses.** `bank_statement` type + line-level extraction + `proposed_entries` per-line review · `ex_expenses` committed ledger · `/app/expenses` views.
- **Phase 5 — Staff, Fleet, Compliance.** `st_*` wages/loans + `/app/staff` (reusing ShiftBoard people/leave) · `fl_*` + `/app/fleet` (manual + document-fed activity) · `cp_documents` + `/app/compliance`.
- **Phase 6 — Settings + final cleanup.** Rehome plugins/import-wizard/members under `/app/settings` · delete remaining old module routes, unused agents per Open Q1 decision, table drops after verification · update `sitemap`/marketing per Open Q4.

Each phase ships behind the standing process rules: own git worktree per feature, `.ai/plan_*.md` before implementation (per Claude_Rules.md), fast-forward deploy to `origin/main`, all SQL pasted by hand by Josh with insert-probe verification. **Josh triggers all live runs; no lead-engine or prod triggering by Claude.**

### 2.6 Verification (per phase)

1. `npx tsc --noEmit` · `npm run lint` · `npm test` (`node --test tests/*.test.ts`; currently 1490 passing — chat-test deletions and `review-queue.test.ts` route-constant updates land with Phase 0).
2. New spine logic gets pure-function tests in the house style (policy/routing/reversal planners as pure modules, like `email-ingest-policy.ts`).
3. DB: every constraint/migration verified by insert-probe against a dev org, never by reading pg_constraint via PostgREST.
4. Live smoke on the TnS org per deploy (email lane flowing, Graph subscription healthy) — **never demo TnS data**; Meridian demo org for demos.
5. Reroute acceptance test: ingest an invoice → commit → reroute to expenses → assert `pp_movements`/`of_*` reversed via `document_effects` and `ex_expenses` row created.

### 2.7 Open questions (need Josh before the relevant phase)

1. **The Brief + nightly agents.** The new IA has no home for `agent_findings`, the 7 agent crons, brief emails, or the weekly digest. Recommendation: keep the agents running and surface findings as a card on each domain dashboard; delete the Brief homepage and brief-schedule emails. Decide before Phase 0 (shell) — affects `/app` landing.
2. **Trial gating.** `TrialGate` still hard-locks the platform on expiry. For a single-client custom build, recommend removing it (with `computeTrial` and the trial columns left in place). Decide in Phase 0.
3. **ServiceDen.** Vyso's own private outreach module (18 pages, 19 routes, 17 tables) — untouched by the new shape. Recommend: keep as-is, reachable by direct URL only. Confirm.
4. **Marketing site.** 46 pages + Orbit sub-brand, including `/platform/modules/*` pages for modules being deleted. This plan leaves marketing untouched; flag that module pages will describe a product that no longer exists. Separate decision/workstream?
5. **Quotes from the client's website.** Which website, and what mechanism (form POST to a new endpoint? email lane? scrape)? `of_quote_requests` + `/api/review/customer` exist as the landing pattern; the intake is undefined. Needed before Phase 3.
6. **Mobile app.** `Vyso Mobile` mirrors `MODULES` and calls the Bearer-auth API routes; the restructure breaks its navigation assumptions and deletes some routes it may call. Out of scope here — park, update, or retire?
7. **Auto-invoice vs "orders = awaiting review".** Confirm the resolution in §2.1 Page 2: confident orders may still auto-invoice (skipping the orders tab), or must every order pause in "awaiting" until a human reviews? The latter reverses a deliberate prior decision and slows the TnS flow.
8. **Old tables' fate.** Drop `pl_*` (minus price lists), PlanWise `pw_*`, `ww_*`, `ig_*`, `sb_` roster tables eventually, or retain indefinitely? Retained by default in this plan.
9. **`desktop/` Electron wrapper (804 MB)** and the untracked `free-scan.sql` / possible live `scan_*` tables + `free-scan` bucket + dashboard cron: confirm deletion/cleanup.
10. **Base branch.** Plan assumes current `origin/main` (`deploy/microsoft-webhook` working branch). The undeployed `redesign/operations-2026` branch (new `--vy-*` token system) is *not* the base — "current design language kept as-is" is read as the deployed `--pf-*` system. Confirm.
