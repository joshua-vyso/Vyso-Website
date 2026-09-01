# Plan: Email source usability (intent vs content kind vs usability)

Date: 2026-08-31. Architect: Fable. Worktree: `.claude/worktrees/email-source-usability`, branch `feature/email-source-usability`, base a7fcf87. No commit/push/deploy — STOP for approval. Do not touch other worktrees, the main tree, or unrelated files.

## Forensic ground truth (live production, verified 2026-08-31)

FOUR SEASONS (ingest 9a22091f…, doc 2feea9da…): Graph body.contentType=html, 1.4KB, link-only (Property/PO metadata + SendGrid-wrapped link to fourseasons.birchstreet.net + tracking pixel). Zero items in body — confirmed. **BUT the email carries a text/html fileAttachment (26KB, `PO_…JBG0118300.html`) containing the COMPLETE purchase order** (12 tables; line grid `# | Item SKU | Product Desc | Qty | UOM | Price | Extension | Tax | … | Total`, e.g. `1 | VEG74 | Melon Spanspek | 6.00 | KG | R59.4000 | R356.40`). Attachment triage marked it `ignored_non_document`. First failure point: **HTML attachments are excluded from document parsing.** The order was fully recoverable without the portal link.

BELAIR (ingest 9a90aab7…, doc 78776a78…): Graph body.contentType=html, 132KB, containing ONE pristine `MsoNormalTable`: exactly 100 `<tr>` × 4 `<td>` (Item | UNIT | stock | order), no colspan, no hidden styles. Ground truth: **8 rows have a non-empty "order" cell** (BABY CARROTS 1, Brocolli 3, Coriander Fresh 200g, Mint Fresh 100g, Parsley Italian Fresh 300g, Patty Pans Yellow 1, Potatoes Large 2, Strawberry Fresh 1); "stock" column empty everywhere. First failure point: **Vyso's Graph fetch sends `prefer: outlook.body-content-type="text"` (microsoft-graph-core.ts:410-425), so Exchange flattens the table cell-per-line server-side before Vyso sees it.** The stored 2.4KB text has no row/column delimiters; the model then produced 97 lines (92 quantity-less), misassigned one qty by row drift, and dropped the three gram-quantities. RECOVERABLE from original HTML.

Cross-cutting: original HTML is preserved NOWHERE (only derived text at the deterministic `email-body` storage path; `email_ingests.body_source_content_type` records Graph's declared type — always 'text' today because of the prefer header). bodyPreview confusion ruled out. Stored graph rest_ids go stale when messages move folders (ImmutableId cutover explicitly OUT of scope — note only). Local forensic copies for fixture modeling (real customer data — DO NOT commit, anonymize): main tree `.ai/belair_graph_body.html`, `.ai/fs_graph_body.html`, `.ai/fs_attachment.html`.

## Code audit facts (base ba8d29e/a7fcf87)

- Single body fetch: fetchMicrosoftGraphMessage (microsoft-graph-core.ts:401-451), `$select` includes body+bodyPreview, `prefer` text. contentType recorded. bodyPreview used only for classification signal + attachment customerEvidence fallback.
- Classification (microsoft-graph-ingest-core.ts:280-374) is pure regex on lowercased text (body capped 20k). Evidence tags capped at 20 unique (boundedEvidence :124). `body:attachment-pointer-only` is lexical only; NO URL detection exists anywhere; nothing ever fetches body URLs.
- Text reader: buildTextOrderPrompt embeds body verbatim (50k cap); extractOrderText runs withArithmetic (quantity_source stamped 'printed'/'derived'/'unresolved') but NEVER auditExtractionStructure → structure_audit null for body orders; NOTHING gates on quantity coverage; the only gate is readBodyOrder (microsoft-message-order.ts:73-76: throw when no customer_name and 0 lines). document-ingest.ts:944 422s the same condition.
- auditExtractionStructure (extraction-quality.ts) doesn't measure quantity coverage, and skipPriceColumnPenalty (:92-93) would score a 97-line qty-less order 'ok' — unusable as-is for the body gate.
- Storage: emailSourceStoragePath(orgId, ingestId, sourcePartId) sha256 path; body stored as text/plain via ingestDocument (body-only) or persistBodySource (reconciliation), 1MB cap.
- extractionMetadata reaches extracted_data ONLY via named-key spread (document-ingest.ts:1012-1014, `Pick<ExtractedData,'message_order_evidence'>`) — new keys MUST be added there by name or they are silently dropped.
- No HTML parser dependency exists (no cheerio/htmlparser2/sanitize-html); two unrelated regex strippers in email-ingest-policy.ts/serviceden-gmail.ts.
- "Items (N)" renders at OrderReviewEditor.tsx:1049; 0-line editor shows "No items read — add what the customer ordered."; per-row red "Quantity could not be established…" but no aggregate. MessageOrderEvidenceNotice (mounted DocumentDetailPanel:196, DocumentReviewQueue:138) renders nothing when no label/conflicts — the natural home for the usability verdict. requires_review exists on MessageOrderEvidence, hard-coded false for body-only (message-order-reconciliation.ts:131).
- Ingest status: finalMicrosoftGraphIngestStatus (ingest-core:505-518): errors→failed; documentsCreated>0→done; intent-without-docs→failed.
- email_ingests.classification_evidence / attachment_diagnostics are ARRAY-constrained jsonb; body_source_content_type free text.

## Design

### D1. Fetch original HTML (Graph, still GET-only)
fetchMicrosoftGraphMessage: REMOVE the `prefer: outlook.body-content-type="text"` header so Graph returns the native body (html or text). Record contentType faithfully. All other Graph behavior unchanged (GET-only, same $select, same idType handling — MICROSOFT_GRAPH_ID_TYPE untouched).

### D2. Deterministic body normalizer — NEW pure module `lib/platform/docu/email-html-normalizer.ts`
Hand-rolled, dependency-free, size-capped (1MB in). NO script execution, NO remote fetches, NO link following. Steps: strip `<script>/<style>/<head>` and `display:none`/`visibility:hidden`/`mso-hide` elements; extract `<table>` blocks → rows → cells (tag-strip + entity-decode inside cells: named nbsp/amp/lt/gt/quot + numeric `&#…;`); extract `<a href>` links (href + visible text; http/https only); remaining markup → line-based plain text (block tags → newlines, `<br>` → newline, collapse whitespace, decode entities). Output: `{ text: string; tables: Array<{ headers: string[] | null; rows: string[][] }>; links: Array<{ href: string; text: string | null; host: string | null }> }`. Table serialization for the reader: `Table 1\nHEADERS: a | b | c\nROW: x | y | z` (pipe-delimited, row-per-line). Outlook `MsoNormalTable` markup from the Belair fixture is the primary target; malformed HTML degrades to text extraction, never throws.

### D3. Body source assessment — NEW pure module `lib/platform/docu/body-source-assessment.ts`
Types (additive, house naming):
- `body_content_kind: 'plain_text' | 'structured_html' | 'external_link' | 'malformed_structured_content' | 'informational' | 'unknown'`
- `body_parse_status: 'complete' | 'partial' | 'unavailable' | 'unsafe_to_infer'`
- `canonical_order_status: 'ready' | 'partial' | 'unavailable' | 'unsafe' | 'conflict'`
- `external_source?: { provider: string | null; host: string; href: string; link_text: string | null } | null` — provider inferred deterministically from hostname (birchstreet→'birchstreet', coupa→'coupa', ariba→'sap_ariba'; else null). Metadata ONLY — never fetched.
Deterministic assessment rules (evidence-grounded; comment each with the fixture that motivated it):
- Graph text body → plain_text/complete (existing behavior).
- HTML with ≥1 well-formed table (≥3 rows, consistent column count ≥2) → structured_html; parse via table serialization.
- HTML link(s) + order intent + no tables + no quantity-bearing lines → external_link/unavailable → canonical unavailable.
- Post-extraction gate — LAYERED (JOSH DECISION 2026-08-31): the usability verdict weighs STRUCTURAL evidence first, quantity coverage second. The ≥15-lines-AND-≥0.7-unresolved rule is a conservative Belair-flattened regression heuristic, NOT the universal definition of malformed — name it accordingly (e.g. FLATTENED_FRAGMENT_HEURISTIC) and apply it ONLY when no recoverable table structure was available (kind !== structured_html). Structural signals to weigh (deterministic where possible): recoverable table rows/cells present; ratio of product-like fragments to coherent rows; repeated UOM/header fragments; fragmented/alternating field sequences (the Belair 4-cycle drift); whether missing data is an optional FIELD (price) vs the ROW RELATIONSHIP itself being ambiguous.
- A coherent recoverable table with blank quantity cells is NOT unsafe: blank order-cells mean "not ordered" → those rows are omitted (D4 prompt clause), and the remaining quantity-bearing rows are usable. The quantity threshold alone must never condemn a structurally coherent source.
- Missing PRICES never trigger unsafe (partial is legitimate — Phase 7): coherent rows with quantities but no prices → ready/partial.
- Structured table parsed cleanly with quantity column → complete → ready.
The assessment is stored on `MessageOrderEvidence` (additive optional fields: body_content_kind, body_parse_status, canonical_order_status, external_source, detected_line_signals: {product_like_count, quantity_coverage}) AND `requires_review: true` when status is unavailable/unsafe/partial-with-warnings. Add the named keys to document-ingest's extractionMetadata spread (the :1012 constraint) — extend the Pick type accordingly.

### D4. Canonical-order creation rule (gate at readBodyOrder, microsoft-message-order.ts)
- ready/partial → create canonical lines as today.
- unavailable (external link) / unsafe → create the review DOCUMENT (order intent + PO/customer metadata + assessment + preserved source) with `line_items: []` — NEVER manufacture lines. Requires relaxing the two zero-line gates for these cases: readBodyOrder returns an assessment-carrying result instead of throwing when (customer evidence OR po reference OR external link) exists; document-ingest's 422 (:944) accepts zero-line orders when the assessment says unavailable/unsafe (still 422 when there is literally nothing reviewable). Ingest status: document created → 'done' (correct behavior, not parser failure). True crashes remain 'failed'.
- For structured tables fed to the reader, add a SCOPED prompt clause (buildTextOrderPrompt only, when tables present): an order-form row whose order/quantity cell is empty is NOT an ordered line — omit it entirely; never invent a quantity for it. (Belair ground truth: 8 canonical lines, not 97.)

### D5. Preserve original body (additive storage)
When contentType=html: store the ORIGINAL exact HTML at emailSourceStoragePath(org, ingest, 'email-body-original') as text/html (same 1MB cap, same idempotent upsert convention); the EXISTING 'email-body' object keeps holding the derived text (normalizer output) — old rows unaffected. email_ingests.body_source_content_type now records the true original type ('html' | 'text'); keep the `?? 'text'` symmetry at the three call sites. Never log raw bodies. Classification consumes the normalizer's derived text (same lowercased/capped pipeline; existing evidence regexes operate on text as before).

### D6. HTML attachments become parseable order sources (fixes the REAL Four Seasons case; scope grounded in Phase 8 / test 21 — flagged to Josh)
In attachment triage (microsoft-graph-ingest-core.ts mime handling): text/html fileAttachments ≤1MB become order-document candidates. Path: decode → email-html-normalizer (same sanitization) → table serialization → extractOrderText → same order pipeline as body orders (deferCommit, review-first, customer matching). source_type: **'html'** (JOSH DECISION 2026-08-31: an attached HTML PO is a first-class source; add 'html' to DocumentSourceType and write it — do NOT encode HTML-ness as null). source_content_type='text/html'. source_type stays nullable only for historical/unknown sources. The DB check constraint must be widened BEFORE deploy — prepare (do not apply) the exact SQL and include it in the completion report:
```sql
alter table documents drop constraint documents_source_type_check;
alter table documents add constraint documents_source_type_check
  check (source_type is null or source_type in ('pdf','image','spreadsheet','email_body','html'));
```
Also update the tracked supabase/microsoft-graph-ingest.sql guarded block to match. Evidence tag `attachment:parsed-html-order`. Idempotency: source_attachment_id = the Graph attachment id (existing uniqueness index covers it). NO remote assets inside attachment HTML are fetched; links inside are inert.
Body+attachment precedence (Phase 8, preserved): usable attachment (pdf/image/html) → attachment canonical; body supplemental/reconciled via existing Wave B semantics; external-link or malformed body never blocks attachment processing; body unusable + no attachment → assessment document per D4.

### D7. UX (MessageOrderEvidenceNotice + OrderReviewEditor)
- external_link: "Customer order detected — [Customer/Property], PO [ref]. Order details are hosted externally ([Provider]). No line items were included in this email." + `Open order link` anchor (target=_blank rel=noopener noreferrer, http/https only, prefer the un-tracked display URL text as label; full href only on the anchor) + the existing review affordances. NOT rendered as a failed empty order: OrderReviewEditor hides the bare "Items (0)/No items read" block when canonical_order_status is unavailable/unsafe and shows the notice instead (manual add-line stays available).
- unsafe: "The email appears to contain a structured order, but its row layout could not be reconstructed reliably. N product-like values were detected, but quantities/row relationships are ambiguous. No order lines were created." + Review source affordance.
- structured_html recovered: normal editor; lines have quantities.
- DocumentReviewQueue compact variants of both messages.
- Never render raw email HTML anywhere — only normalized text/derived data (sanitized by construction).

### D8. Statuses / review state
No new DB statuses. 'done' when a reviewable document exists; 'failed' only for true failures; requires_review=true carried in message_order_evidence for unavailable/unsafe/conflict. Customer matching continues to run on metadata even when lines are unavailable (Four Seasons: sender domain/property) — but NO operational order is created from matching alone (deferCommit + review-first unchanged).

## Files to change
NEW: lib/platform/docu/email-html-normalizer.ts, lib/platform/docu/body-source-assessment.ts, tests/email-html-normalizer.test.ts, tests/body-source-assessment.test.ts (+ fixtures inline, ANONYMIZED — model on the forensic files but never commit real names/URLs/tokens).
MODIFIED: lib/platform/microsoft-graph-core.ts (drop prefer-text; faithful contentType), lib/platform/microsoft-graph-ingest-core.ts (classification input from normalizer text; html-attachment triage; evidence tags — respect the 20-cap), lib/platform/microsoft-graph-ingest.ts (adapter threading), lib/platform/microsoft-message-order.ts (original-HTML preservation, assessment, gate, zero-line document path), lib/platform/docu/message-order-reconciliation.ts (additive MessageOrderEvidence fields; requires_review), lib/platform/document-ingest.ts (named-key spread additions; zero-line acceptance for assessed orders; html-attachment ingest input), lib/ai/order-prompt.ts (scoped table-form clause in buildTextOrderPrompt), lib/platform/types.ts (additive fields), components/platform/docu/MessageOrderEvidenceNotice.tsx, components/platform/docu/OrderReviewEditor.tsx (assessment-aware Items block), components/platform/docu/DocumentReviewQueue.tsx, components/platform/docu/DocumentDetailPanel.tsx (label), tests/microsoft-graph-ingest.test.ts + tests/message-order-reconciliation.test.ts + tests/docu-order-prompt.test.ts (extended).

## NOT touched
Webhook architecture, subscription scope/renewal, MICROSOFT_GRAPH_ID_TYPE (rest_id), deferCommit, customer matching internals, UOM/alias rules, locale parser, VAT validation, financial lane, ProcurePulse/SupplySync/OrderFlow writes, Xero. NO link fetching/scraping/auth anywhere. NO XLSX. NO backfill/reprocessing of live rows.

## Migration
NONE. (source_type constraint deliberately not widened — html attachments use null + source_content_type. Flag as optional follow-up.)

## Security checklist (assert in tests where possible)
No script/style content survives normalization; hidden elements dropped; only http/https hrefs surfaced; no fetch/URL-following in any new code path (source-assert no fetch of non-graph hosts); raw HTML stored privately, never rendered; entity/NBSP handling safe; 1MB caps; tracking-wrapper hrefs stored but never dereferenced.

## Test matrix (from task, 1-35 — implement all)
External link: order-notification fixture → customer_order intent, external_link/unavailable, zero canonical lines, PO+customer+URL preserved, provider 'birchstreet' from host, no fetch (source assertion), no operational order, not rendered as failed empty order.
Structured HTML: valid table rows/cells preserved; order-form table → exactly the quantity-bearing rows become canonical (Belair-shaped fixture: 100×4, 8 ordered rows incl. gram quantities 200g/100g/300g); repeated headers not products; hidden cells dropped; NBSP/entities safe.
Malformed: flattened cell-per-line fixture (97 product-like, ≥90 no qty) → unsafe_to_infer, no pseudo-lines, clear review message.
Plain text: existing body-order fixtures still green; "10kg potatoes / 5kg carrots" still extracts.
Partial: rows with qty but no prices → ready/partial, NOT unsafe.
Body+attachment: malformed body + good attachment → attachment canonical; external-link body + html attachment → attachment canonical (Four Seasons-shaped); valid body + attachment → existing reconciliation.
Regressions: Wave B, VAT, confidence, financial-lane (expense_receipt not entering order path), locale-number, Graph, renewal — full suite green; tsc; lint (no new); build; git diff --check.

## Verification
npm install; npx tsc --noEmit; focused new tests; npm test (baseline 1311 at a7fcf87); npm run lint (baseline first); npm run build; git diff --check. NO commit/push. STOP.
