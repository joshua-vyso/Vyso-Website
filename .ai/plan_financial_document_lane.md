# Plan: Financial-only document lane (expense receipts)

Date: 2026-08-30. Architect: Fable. Worktree: `.claude/worktrees/financial-document-lane`, branch `feature/financial-document-lane`, base ba8d29e (origin/main with VAT/confidence + Wave B). DO NOT touch the Wave B worktree or amend ba8d29e. No deploy — STOP after verification.

## Goal

Documents like the Country Club Johannesburg receipt (meal R583.10 + gratuity R60.00 = settlement R643.10, VAT incl. R76.06, paid by drawing down a pre-funded member balance R2,454.68 → R1,811.58) must be ingested, classified `expense_receipt`, understood financially, and reviewed in Doc-U — while being HARD-EXCLUDED from every operational workflow. "Not operationally relevant" ≠ "financially irrelevant". Expense timing ≠ bank cash timing: a pre-fund drawdown implies NO direct bank movement on the receipt date.

## Established audit facts (do not re-derive; file:line refs from ba8d29e)

- DocumentType union: types.ts:44-49 (five values). Prompt enum: anthropic.ts:152. No DB CREATE TABLE for documents in repo; PaymentsView.tsx:508 already writes out-of-enum 'receipt' (feature unused; constraint unverified — see Deploy prerequisites).
- TODAY a restaurant receipt classifies as 'invoice' and contaminates: suppliers row (document-ingest.ts:1121-1127 resolveSupplierProfile), ProcurePulse stock (procurepulse-feed.ts:25 FEED_TYPES includes invoice), SupplySync timeline+spend (supplysync-feed.ts:196 deny-list only excludes 'order'; SPEND_DOC_TYPES:153), Price Watch (run.ts:123), Doc Watch (detect.ts:44), Hubdoc (hubdoc-shared.ts:92), Xero Watch (xero-watch/run.ts:360).
- THE choke point for all confirm paths: runDocumentSideEffects (document-ingest.ts:347-399) — Doc-U save, review chat approve, chat drop, email deferred commit all funnel here.
- Escalation leak: classification-policy.ts:69-81 can relabel a low-confidence receipt as 'order' via document-ingest.ts:788-826 adoption.
- syncOrderFromDocument (orderflow-from-doc.ts:241) has NO internal type guard (its 3 callers gate).
- supplysync-pricing.ts:163 `if (d.document_type && !PRICED_DOC_TYPES.has(...)) continue` lets null-typed docs through.
- House pattern for a type-specific block: StatementSummary (`extracted_data.summary`, docu/types.ts:18-31, coerced in anthropic.ts, rendered by StatementTotalsCard gated in DocumentDetailPanel.tsx:261). Routing-affecting flag in extracted_data precedent: `direction` (honoured by procurepulse-feed.ts:273).
- Editor pick: DocumentDetailPanel.tsx:207-228 binary order/other → add third arm.
- routing.ts:9-33 RULES is Record<DocumentType,…> — adding a type is a compile error until an entry exists.
- No expense-category system, no cash/expense/ledger model exists. Xero integration is a read-only mirror (invoices+contacts only; scopes lack accounting.transactions) — NOTHING to write, nothing to change there.
- VAT/confidence primitives to reuse: parseAmount + lineSeparatorHint/inferDecimalSeparator, moneyMatches, reconcileDocumentTotals conventions (skip-don't-zero), coerceConfidence (null ≠ 0).

## Design

### 1. Classification (additive)

- Add `'expense_receipt'` to DocumentType (types.ts) and the classification prompt enum (anthropic.ts EXTRACT_INSTRUCTION), with prompt guidance in house voice: till slips / restaurant / fuel / hotel / parking receipts recording consumption the business paid for — NOT supplier invoices for stock/produce (a produce invoice from a supplier stays 'invoice'; when in doubt between invoice and expense_receipt for a document with product purchase lines destined for resale/stock, prefer invoice).
- For expense_receipt the model fills a new `financial_document` object (mirror the statements `summary` pattern; all money values verbatim strings, "" when absent, NEVER computed):
  merchant, receipt_reference, receipt_datetime, member_or_account, line items reuse existing line_items (description/quantity/unit_price/amount verbatim), subtotal, gratuity, tax_amount (VAT included), total, currency, payment_method, funding_account, opening_balance, settlement_amount, closing_balance, notes.
  Prompt must state: gratuity is not VAT; a VAT-INCLUSIVE total is not net+VAT; balances are transcribed only when printed; never infer.
- `business_effect` dimension, stored additively in `extracted_data.business_effect`: 'operational_financial' | 'financial_only' | 'operational_only' | 'informational'. Stamped at ingest from document_type (expense_receipt→financial_only; order/invoice/statement/delivery_note→operational_financial; price_list→operational_only). New pure helper `documentBusinessEffect(doc)` (new file lib/platform/docu/business-effect.ts) DERIVES the effect from document_type when the stored key is absent — legacy rows need no backfill. All gating goes through this helper, never reads the raw key directly.
- Escalation guard: in decideClassificationRouting, an `expense_receipt` classification returns 'accept' UNLESS the order-keyword/PO-number regexes (classification-policy.ts:44-48) match the text — a receipt must not be adopted as an order purely on structure score. Keep every other path byte-identical.

### 2. Hard routing exclusions (defense in depth — ALL of these)

a. runDocumentSideEffects (document-ingest.ts): FIRST check — if documentBusinessEffect(doc) === 'financial_only', return early with an explicit result (no order sync, no PP, no SS). Comment: this is the single gate every confirm path crosses.
b. Non-order ingest branch: skip resolveSupplierProfile for expense_receipt (the restaurant must never become a suppliers row / SupplySync profile). Keep parties/direction classification if harmless, or skip entirely — implementer picks the smaller change; supplier creation is the forbidden part.
c. feedDocumentToSupplySync (supplysync-feed.ts:196): add explicit financial_only exclusion beside the 'order' one (keep deny-list style, one more deny + comment on why it isn't an allow-list rewrite).
d. supplysync-pricing.ts:163: change guard to also skip null document_type (`if (!d.document_type || !PRICED_DOC_TYPES.has(d.document_type)) continue;`) — conservative fix for the null leak, comment why.
e. syncOrderFromDocument: add document_type to its select and an internal defensive guard — return a non-ok result if the row's document_type !== 'order' (mirror caller error semantics; comment that three callers gate independently and this is the last line of defense). Change NOTHING else in the file.
f. routing.ts RULES: `expense_receipt: []` (Push-to menu stays empty).
g. Hubdoc, Price Watch, Doc Watch, ProcurePulse, Xero Watch: allow-lists already exclude — DO NOT modify (except verify via tests).
h. relationships.ts STAGES, missing-docs.ts: leave receipts out of the order→delivery→invoice→statement chain.

### 3. Financial reconciliation (pure module, new file lib/platform/docu/financial-document.ts)

- Types: `FinancialDocument` (verbatim string fields above + `expense_category?: string | null` + `cash_effect: 'prefund_drawdown' | 'unknown'`), `ExtractedData.financial_document?: FinancialDocument | null`, `ExtractedData.business_effect?`.
- `reconcileFinancialDocument(fin, lines, hint)` using parseAmount + moneyMatches, skip-don't-zero (same convention as reconcileDocumentTotals):
  - subtotal + gratuity ≈ total (only fields present; gratuity absent → subtotal ≈ total).
  - Σ line amounts ≈ subtotal (when both present).
  - opening_balance − settlement ≈ closing_balance (when all three present) → balance movement valid.
  - tax_amount is VAT-INCLUDED: check tax_amount < total; NEVER add tax on top of total; NEVER treat gratuity as tax.
  - settlement ≈ total (when both present).
- `cash_effect` derivation (conservative, never asserts a bank movement): balances present and reconciling → 'prefund_drawdown'; everything else → 'unknown'. NO 'direct' value in v1 — even an explicit card payment does not assert same-day bank movement.
- Expense categories: new lib/platform/docu/expense-categories.ts — fixed const list: Meals & entertainment, Fuel, Travel, Accommodation, Parking, Office expenses, Subscriptions, Repairs & maintenance, Professional services, Other. The model may suggest one (validated against the list; invalid → null); reviewer can change; never locked.

### 4. Review UX

- DocumentDetailPanel: third arm — `document_type === 'expense_receipt'` → new `ReceiptReviewCard` (client component, current Doc-U styling): merchant + date header, "Expense receipt" label, expense total, "VAT included R76.06", "Paid via <funding_account/payment_method>", "Balance R2,454.68 → R1,811.58" when present, "Operational impact: None · Financial impact: Expense recognised", category select (suggested value preselected), editable funding account, Confirm button (→ existing review/commit route, which now no-ops operationally via gate 2a), and reconciliation warnings from reconcileFinancialDocument (reuse the red/amber conventions from OrderReviewEditor).
- Confidence: existing ConfidenceText / null-semantics untouched; ReceiptReviewCard shows document confidence via existing components; reviewer confirm does not rewrite extraction confidence.
- review-queue-shared.ts:271-273: expense_receipt gets its own bucket/label (not "Invoices").
- DocumentReviewQueue.tsx:214 save copy: type-aware — for financial_only: "Saving records the expense — no stock, supplier or order changes."
- documents.ts DOC_TYPES/labels, docu/folders.ts, docu/search.ts TYPE_WORDS, TypePicker list, DocumentFilters, DocumentsTable/InboxView labels, finch tools enum (lib/ai/finch/tools.ts:242-246) + docu-data DOC_TYPES: add the type with label "Expense receipt". flags.ts: exclude expense_receipt from unusual_spend/statement/invoice flags (type-gated already — verify).
- microsoft-graph-ingest-core classificationFromDocumentType: unmatched → current behavior (fine); add no email-side changes.

### 5. Explicitly NOT in scope

No Xero writes or Xero code changes; no reconciliation-candidate UI (scopes lack accounting.transactions — deferred); no new tables/ledger; no navigation redesign; no XLSX; no backfill; no changes to Wave B reconciliation, VAT validation internals, customer matching, UOM rules, locale parser, Graph files; TypePicker manual-retype behavior stays (human override is deliberate).

## Files to change

New: lib/platform/docu/business-effect.ts, lib/platform/docu/financial-document.ts, lib/platform/docu/expense-categories.ts, components/platform/docu/ReceiptReviewCard.tsx, tests/docu-financial-document.test.ts, tests/docu-business-effect.test.ts.
Modified: lib/platform/types.ts, lib/ai/anthropic.ts (prompt + coerce financial_document + type), lib/platform/docu/types.ts (DocuExtractedData), lib/platform/docu/classification-policy.ts, lib/platform/document-ingest.ts (gate 2a/2b + stamp business_effect + persist financial_document), lib/platform/orderflow-from-doc.ts (defensive guard only), lib/platform/supplysync-feed.ts, lib/platform/supplysync-pricing.ts, lib/platform/docu/routing.ts, lib/platform/documents.ts, lib/platform/docu/folders.ts, lib/platform/docu/search.ts, lib/platform/review-queue-shared.ts, components/platform/docu/{DocumentDetailPanel,DocumentReviewQueue,TypePicker,DocumentFilters}.tsx, components/platform/DocumentsTable.tsx, components/platform/InboxView.tsx, lib/ai/finch/tools.ts, lib/ai/finch/docu-data.ts, lib/platform/docu/flags.ts (only if needed), app/api/ai/extract/route.ts (persist financial_document/business_effect on the manual-upload path).

## Migration

NONE (all additive jsonb). ⚠ Deploy prerequisite (NOT ours to run): verify the live documents table has no CHECK constraint restricting document_type — Josh runs in SQL editor:
`select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'documents'::regclass and contype = 'c';`
If a restrictive constraint exists, it must be widened before deploy.

## Tests (all pure-logic testable; extract pure helpers where supabase-bound)

1-3. Receipt fixtures classify→financial_only (business-effect helper + category validation): restaurant, fuel, hotel shapes.
4-7. supplier produce invoice stays operational_financial; order stays order; statement stays statement; correspondence untouched (regression via existing suites + business-effect derivation tests).
8. Country Club fixture: subtotal 583.10 + gratuity 60.00 = 643.10 total ✓; VAT 76.06 preserved, included, not added; lines sum ✓.
9. Prefund: 2454.68 − 643.10 = 1811.58 → valid balance movement, cash_effect='prefund_drawdown', NO bank cash outflow field asserted.
10. Broken balance (closing 1800.00) → mismatch reported.
11. Card receipt: no balances → cash_effect='unknown'; expense R500 recognised; no same-day bank movement inferred.
12. Gratuity never treated as VAT; VAT never double-counted.
13. Comma-decimal receipt values safe under hint.
14. Missing confidence stays null (reuse coerceConfidence — no new coercions).
15. shouldRun/side-effect gate: financial_only → no operational side effects (test the pure helper); expense_receipt excluded from SupplySync/pricing gates (test extracted predicates).
16. syncOrderFromDocument defensive guard: non-order doc → non-ok, no writes (unit-test the guard logic if seam allows; else assert via the pure gate + comment).
17. Escalation: expense_receipt classification not adopted as order absent order keywords.
18. Full suite (baseline 1274 + Wave B additions), tsc, lint (no new), build, git diff --check.

## Verification commands

npm install; npx tsc --noEmit; node --test tests/docu-financial-document.test.ts tests/docu-business-effect.test.ts; npm test; npm run lint; npm run build; git diff --check. NO commit, NO push — leave dirty for architect review. STOP for approval.
