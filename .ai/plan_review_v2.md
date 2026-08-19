# Plan: Review v2 — grouped queue, inline expand (split view), batch approvals, master approve

Status: **approved by Josh 2026-08-19** (verbatim: "review chain needs automatic approvals. grouped by module, then
subgrouped by task (quotes separated from new orders). batch approve button for each task, on each module and a master
'approve all' at the top. clicking an item expands that block in place (not a new page) showing the original document and
key items (total, date, confidence…; for quotes: message body, email, 'add new customer' which adds them to OrderFlow).
'view in {module}' for line-by-line. review chain centred on open, moves left and the expanded view appears on the right;
close returns it to centre in a fluid animation"). Architect: Fable. Implementer: one Opus agent on `main`.

Starting point (Review v1, commit 2ff4810): `lib/platform/review-queue{,-shared}.ts` (computed queue: Doc-U awaiting ∪
flagged with claim guard; `of_quote_requests` status new & not spam), `app/app/chat/review/page.tsx`,
`components/platform/chat/ReviewOpening.tsx` (flat grouped list + links), `components/platform/shell/RailReview.tsx`,
persistent `module='review'` finch chat beneath. No approval writes exist in the chat; approvals live on Doc-U's review
screen (`app/api/docu/review`, `lib/platform/docu/*` — read the exact write path: approved_at/status/claim) and on the
quotes screen (`app/app/orderflow/quotes*`, `supabase/quote-requests.sql` — read what statuses exist and what "handled"
means there: e.g. `reviewed`/`converted`/`declined`).

## 1. Acceptance
1. `/app/chat/review` opens with the **review chain centred** (max-width ~720 px). Chain = groups by **module** (Doc-U,
   OrderFlow, later Plugins) → **task** (Doc-U: "Invoices to approve", "Statements", "Flagged / low confidence";
   OrderFlow: "Quote requests", "New orders" — orders only if the existing data model has an unconfirmed-order concept;
   otherwise omit the sub-group, don't invent). Each task header shows a count and **"Approve all N"**; each module header
   shows **"Approve all in {module}"**; the page top shows **"Approve all ({total})"** with a confirm step ("Approve 14
   items — this can't be undone here; you can still edit them in their modules").
2. **Clicking an item expands it in place** (accordion within the chain) AND opens the **detail pane on the right**:
   the chain slides left (`transform`/flex-basis transition ~320 ms ease-out, tokens from `tokens/motion.css` equivalents
   already in `app/globals.css`; `prefers-reduced-motion` → instant), the pane fades/slides in from the right. **Close**
   (× or Esc) reverses it. Only one item expanded at a time. URL reflects it (`?item=<kind>:<id>`) so reload restores.
3. **Detail pane, documents**: original file preview (reuse Doc-U's signed-URL preview — `app/app/docu/[id]/page.tsx`
   builds it; factor into a shared `DocumentPreview` component if not already; images `<img>`, PDFs `<iframe>`), key
   fields: supplier, document type, number, date, **total (incl. VAT)**, VAT, line count, **confidence** (and the flag
   reasons if flagged), uploaded-by/when, Doc Watch sentence if a `doc_watch` finding exists for it; buttons: **Approve**,
   **Reject** (if Doc-U has a reject/archive action — else "Mark as error"? NO: only actions that exist; otherwise omit),
   **View in Doc-U →** (`/app/docu/[id]`), Send to Hubdoc (only when X2's button would render).
4. **Detail pane, quote requests**: message body (verbatim), sender name/email/phone, received when, items requested if
   parsed; buttons: **Add as new customer** (creates `of_customers` from name/email/phone via the existing OrderFlow
   customer creation path — read `lib/platform/orderflow-data.ts`/`app/api/orderflow/*`; disabled with "already a
   customer" when an `of_customers` row matches email), **Mark handled** (= the quote's existing "done" status),
   **View in OrderFlow →** (the quote screen).
5. **Approvals are real writes through the modules' own paths** — call the SAME server functions/routes Doc-U and the
   quotes screen use (no second approval semantics). New route `app/api/review/approve/route.ts` `POST {items:[{kind,id}]}`
   → per item: permission check (module access; money-gated kinds need `canSeeMoney`) → module approve fn → result per
   item `{id, ok, error}`; serial, capped 100, idempotent (already approved → ok:true, note). Batch buttons call it with
   the task/module/all selection; the chain updates optimistically then `router.refresh()`; the Review row/dot and the
   rail count refresh; when the queue hits zero the page shows "All clear" and the row disappears (v1 behaviour).
6. The Finch chat beneath stays (v1); its prelude includes the currently expanded item so "what's odd about this invoice?"
   works without restating. Zero model calls for the chain/pane themselves.
7. Mobile (<lg): chain full-width, pane becomes a bottom sheet; same actions.

## 2. Files
Create: `components/platform/review/{ReviewChain,ReviewGroup,ReviewItemRow,ReviewPane,DocumentReviewPane,
QuoteReviewPane,ApproveAllButton}.tsx`, `components/platform/docu/DocumentPreview.tsx` (if factoring), `lib/platform/
review-actions.ts` (server: `approveItems(...)` delegating to module fns; pure `-shared.ts`: grouping by module/task,
selection maths, result merging — tests `tests/review-actions.test.ts`, extend `tests/review-queue.test.ts`),
`app/api/review/approve/route.ts`, `app/api/review/customer/route.ts` (add customer from a quote request).
Modify: `lib/platform/review-queue{,-shared}.ts` (task sub-grouping + the detail payload per item: loaded lazily via
`GET /api/review/item?kind&id` to keep the page light — or inline if cheap; decide, record), `app/app/chat/review/page.tsx`
(layout: chain + pane), `components/platform/chat/ReviewOpening.tsx` (→ replaced by `ReviewChain`; keep the file name or
delete — no dangling imports), `components/platform/shell/FinchChatProvider.tsx` (prelude incl. expanded item),
`app/globals.css` (keyframes/transition block, commented), `lib/ai/finch/knowledge.ts` (Review paragraph: batch approve
exists; Finch itself still doesn't approve), `.ai/implementation.md` ("Review v2").
Do not touch: agents, plugins X1/X2 beyond reusing the Hubdoc button, price-watch, marketing.

## 3. Edge cases
Approving an item another user already approved → ok (no error toast), chain refreshes; an approval that fails → the
row stays with an inline error, others proceed; "Approve all" with mixed permissions → only permitted kinds are sent,
the button label says "Approve all you can (N)"; an expanded item that gets approved/removed → pane shows "Done" and
closes after 600 ms; keyboard: ↑/↓ move, Enter expands, Esc closes; deep link `?item=` to an item no longer in the queue
→ chain centred, toast "already handled"; quote sender with no email → "Add as new customer" creates with phone only or
is disabled if the customer model requires email (read the constraint); very large preview → iframe scrolls inside the
pane.

## 4. Verification
Unit tests (grouping, selection, result merge, customer-payload builder); tsc/test/build/lint ≤ 50; W6 clicks: open
Review with 3 docs + 1 quote → centred chain; click a doc → slides left, pane shows PDF + fields → Approve → row gone,
pane "Done" → close → centred; click quote → body/email → Add as new customer → OrderFlow customer exists → Mark handled;
"Approve all" → confirm → queue empty → row disappears. Commit `review(v2): grouped chain, split-view detail, batch +
master approvals`.
