-- ############################################################################
-- ##
-- ##  MERIDIAN FOOD CO.  —  AUGUST 2026 REFRESH, PART B  (the Review queue)
-- ##  supabase/demo-refresh-2026-08b.sql   ·   written 2026-08-19
-- ##
-- ############################################################################
--
-- WHAT THIS IS
--   The Review beat of the Loom (`docs/demo-loom-script.md` v2) needs the rail's
--   Review row to appear, and it needs `/app/chat/review` to open on a SHORT,
--   LEGIBLE grouped chain — not a wall. This file makes the queue read exactly:
--
--       Doc-U      · Invoices to approve ................ 2
--       Doc-U      · Statements .......................... 1
--       Doc-U      · Flagged — Vyso could not read these . 1
--       OrderFlow  · Quote requests ...................... 2
--                                                        ---
--                                                          6
--
--   It does that in two moves. Section 1-2 ADD the six rows above. Section 3
--   QUIETENS the backlog the seed left behind, which is the part to read before
--   you run this: `demo-all-in-one.sql` seeds 20 `extracted` + 2 `pending` +
--   2 `error` documents and 6 `status='new'` quote requests, and
--   `lib/platform/review-queue.ts` computes the queue from exactly those
--   predicates. Without section 3 the rail's dot reads 30 and the chain opens on
--   thirty rows, which is a different product than the one the Loom describes.
--
-- PREREQUISITES  (in this order, all of them)
--   1. `supabase/demo-all-in-one.sql`      — the workspace.
--   2. `supabase/demo-refresh-2026-08.sql` — August. Creates folder 901
--      ("Supplier invoices — August"), which two documents below file into.
--   3. `supabase/docu-review-columns.sql`  — `documents.approved_at`,
--      `.archived_at`. The queue's claim guard reads `approved_at`; section 3
--      writes `archived_at`; the verification block at the end selects both. On
--      a database without them this file fails loudly at the first reference
--      rather than half-applying (the Supabase SQL editor runs a pasted script
--      as one transaction).
--   4. `supabase/quote-requests.sql`       — `of_quote_requests`.
--
-- ⚠  RE-RUN ORDER MATTERS, AND THIS IS THE ONE FOOTGUN IN THE FILE.
--   `demo-refresh-2026-08.sql`'s own delete preamble is
--       delete from documents … where id::text like '20000000-…-0000000009%'
--   and that pattern matches counters 900-999 — i.e. it matches THIS file's
--   documents (911-914) as well as its own (901-906). So:
--
--       running 08  after 08b  ⇒  08b's four documents are deleted.
--       ALWAYS RE-RUN 08b AFTER YOU RE-RUN 08.
--
--   The reverse is safe: this file's preamble is narrowed to `…00000000091%`
--   (910-919 only) and never touches 901-906.
--
-- HOW TO APPLY
--   Paste the whole file into the Supabase SQL editor and run it once.
--   IDEMPOTENT and RE-RUNNABLE. Section 0 deletes exactly the rows sections 1-2
--   write, scoped to org + this file's own id block. Section 3 is a set of
--   UPDATEs whose predicates are satisfied at most once — a second run finds
--   nothing left to change and reports 0 rows.
--
-- WHAT IT DOES NOT DO
--   No `create table`, no `alter`, no `drop`, no `gen_random_uuid()`, and not
--   one cast of a uuid tail to an integer (see 08's header for why that rule
--   exists — it is what made 08 survive a LIVE Meridian).
--
-- ============================================================================
-- PRICE WATCH IS DELIBERATELY UNMOVED
-- ============================================================================
--   Every document below is read by `lib/platform/price-watch/run.ts` — its
--   EXCLUDED_STATUSES is only {rejected, archived}, so 'extracted' and 'error'
--   documents ARE price sources. The Loom quotes four engineered series
--   (+10.1 % oil, +11.0 % cheese, +10.0 % fish, −4 % salad mix), and a careless
--   new invoice would move a median and make the script stale. So:
--
--     * NO document here touches a watched line. Not "Cooking oil (5L)", not
--       "Cheese block", not "Line fish fillet", not "Prepared Salad Mix (2kg
--       tub)".
--     * The two supplier invoices repeat their supplier's LAST SEEN price to
--       the cent (Helderberg: R168.00 / R118.00, doc 15, 21 Jul. Swartland:
--       R132.00 / R118.00 / R42.00, doc 13, 14 Jul), with descriptions BYTE-
--       IDENTICAL to those documents so they resolve to the same canonical
--       `pw_item` instead of opening a second one-point series. A repeated
--       price is a 0.0 % move: `detect.ts` reports increases only.
--     * The statement repeats Bergriver's June statement wording and prices
--       (R147.00 / R131.00 / R70.00, doc 25) for the same reason.
--     * The flagged invoice is Peninsula Beverage Supply — a supplier with NO
--       documents in the seed at all, so its two lines are first observations
--       and a one-point series can never fire a finding.
--
--   Section 3's status changes are equally inert for Price Watch: 'extracted' →
--   'reviewed' is not in EXCLUDED_STATUSES either way, and the four documents
--   moved to 'archived' are 2 `pending` rows (no `extracted_data`, therefore no
--   observations) and 2 `error` rows (doc 16 Stellenbosch Seedling, doc 34 a
--   customer order — neither is in a watched series).
--
-- ============================================================================
-- THE SIX ROWS, IN FULL  (this table is what the Loom is allowed to say)
-- ============================================================================
--
--   DOCUMENTS (group 20, counters 911-914)
--
--   911  Helderberg Packaging — Invoice INV-9188        extracted   conf 91
--        18 Aug 2026 · folder 901 · R 195 454.00 incl VAT
--        520 sleeve Punnets & Trays @ R168.00  = R 87 360.00
--        700 bundle Cartons - Standard @ R118.00 = R 82 600.00
--
--   912  Swartland Grain & Mill — Invoice INV-5241      extracted   conf 93
--        19 Aug 2026 · folder 901 · R 358 432.00 incl VAT
--        760 bag Cake Flour (12.5kg) @ R132.00   = R 100 320.00
--        880 bag Maize Meal (12.5kg) @ R118.00   = R 103 840.00
--      2 560 bag Bread Rolls (24/bag) @ R42.00   = R 107 520.00
--
--   913  Bergriver Growers — Statement, July 2026       extracted   conf 92
--        landed 18 Aug 2026 · folder 3 (Supplier statements)
--        opening R 406 100.00 (= June's closing, doc 25) → closing R 437 000.00
--
--   914  Peninsula Beverage Supply — Invoice INV-3077   error       conf 58
--        19 Aug 2026 · UNFILED (folder null) · R 86 721.50 incl VAT
--        This is the "Flagged — Vyso could not read this one" row. Field
--        confidences 44-62, all below DOC_LOW_CONFIDENCE_THRESHOLD (80).
--
--   QUOTE REQUESTS (group 41, counters 911-912)
--
--   911  Elmarie van Wyk · Boland Trading Co.           new · not spam
--        orders@bolandtrading.co.za · 18 Aug 2026 16:42
--        THE "ALREADY A CUSTOMER" ROW. `of_customers` #1 is Boland Trading Co.
--        at that exact address, so `findExistingCustomer`
--        (lib/platform/review-actions-shared.ts) matches on email AND again on
--        the normalised name, and QuoteReviewPane renders
--        "Already a customer — Boland Trading Co." instead of the button.
--
--   912  Thandi Mokoena · Karoo Function Hire           new · not spam
--        thandi@karoofunctionhire.co.za · 19 Aug 2026 07:18
--        THE NEW PROSPECT. Nothing in `of_customers` matches by email or by
--        name, so "Add as new customer" is live and creates
--        name 'Karoo Function Hire' (business_name wins — that is who you
--        invoice), email thandi@karoofunctionhire.co.za, phone +27 82 447 1130.
--        40 × prepared salad mix and 20 kg line fish for 29 Aug.
--
--   NOTE ON THE NAME "Thandi Mokoena": the seed's quote request #5 uses the same
--   contact name for a different business (Paarl Market Stall). Section 3 takes
--   all six seed requests out of the queue, so the two never appear together —
--   but if you ever skip section 3, rename one of them before recording.
--
-- ============================================================================
-- STORAGE — THE FOUR PDFs
-- ============================================================================
--   `storage_path` follows the house rule, `'demo/docu/' || filename`, so
--   Doc-U's preview pane (`app/app/docu/[id]/page.tsx:80`, bucket `documents`,
--   key EXACTLY the storage_path) resolves once the objects exist. Four files
--   to generate and upload, exactly as `docs/demo-runbook.md` §7 describes:
--
--       demo/docu/helderberg-packaging-INV-9188.pdf
--       demo/docu/swartland-grain-INV-5241.pdf
--       demo/docu/bergriver-growers-STMT-2026-07.pdf
--       demo/docu/peninsula-beverage-INV-3077.pdf
--
--   `scripts/demo-invoice-pdfs.mjs` renders them: it parses the document rows
--   out of the SQL generically (DOC_ROW / parseDocuments), and this file is now
--   the third entry in its `SEED_FILES`, so
--
--       node scripts/demo-invoice-pdfs.mjs --pdfkit /tmp/pdfgen --out /tmp/demo-pdfs
--
--   emits 41 PDFs instead of 37, and
--
--       node scripts/demo-invoice-pdfs.mjs --only 911,912,913,914 --pdfkit … --out …
--
--   emits just these four. THE ROW SHAPE BELOW IS PART OF THAT CONTRACT: the
--   parser matches `(n, sup, cust, folder, 'file', 'type', 'status', conf,`
--   then the JSON on the NEXT line, in one unbroken line. Do not reformat.
--
-- ============================================================================
-- SEED IDS REFERENCED BUT NOT CREATED HERE
-- ============================================================================
--   org             01000000-7e5d-4c1a-9b3f-000000000001   Meridian Food Co.
--   suppliers  (04) 1 Bergriver Growers · 6 Swartland Grain & Mill
--                   9 Helderberg Packaging · 12 Peninsula Beverage Supply
--   folders    (21) 3 "Supplier statements" (seed) · 901 "Supplier invoices —
--                   August" (created by demo-refresh-2026-08.sql §1.1)
--   customers  (05) 1 Boland Trading Co., orders@bolandtrading.co.za
--
-- ############################################################################


-- ##########################################################################
-- ##  SECTION 0 — DELETE PREAMBLE
-- ##  Org + this file's own id block, and nothing else. Both patterns pin
-- ##  the counter to 910-919: the seed's highest is 34 (documents) / 6
-- ##  (quote requests), and 08's is 906, so neither can be matched.
-- ##########################################################################

delete from documents          where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '20000000-7e5d-4c1a-9b3f-00000000091%';
delete from of_quote_requests  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '41000000-7e5d-4c1a-9b3f-00000000091%';


-- ##########################################################################
-- ##  SECTION 1 — DOC-U: four documents awaiting a decision
-- ##########################################################################
--
-- WHICH TASK EACH ROW LANDS IN. `reviewDocumentTask()`
-- (lib/platform/review-queue-shared.ts) is two lines:
--
--     status = 'error'            → 'docu:flagged'      (NOT approvable)
--     document_type = 'statement' → 'docu:statements'
--     otherwise                   → 'docu:invoices'
--
-- so 911/912 are the invoice pile, 913 is the statement pile and 914 is the
-- flagged pile. Low confidence is NOT a task of its own — `/app/docu/confidence`
-- sorts, it does not filter — so 914 is flagged because of its STATUS, and its
-- 58 % is said on the row by `reviewDocumentDetail` instead.
--
-- `approved_at` IS NOT WRITTEN, so it defaults to NULL and `isClaimableDocument`
-- returns true for all four: nobody is mid-Save on them. That is the whole
-- difference between "waiting for a decision" and "having one made".
--
-- `created_at` IS the document's own date, not "now", so Doc-U's list, the
-- supplier feed and the queue's newest-first ordering all agree.
--
-- Amounts are ex-VAT per line; "Total (incl. VAT)" = sum × 1.15, exactly as the
-- seed's docs 1-16 do it.
-- ---------------------------------------------------------------------------
insert into documents (
  id, org_id, supplier_id, customer_id, folder_id, filename, document_type, status,
  confidence, extracted_data, storage_path, uploaded_by, entity_type, entity_id, created_at
)
select ('20000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       case when v.sup    is not null then ('04000000-7e5d-4c1a-9b3f-' || lpad(v.sup::text,    12, '0'))::uuid end,
       case when v.cust   is not null then ('05000000-7e5d-4c1a-9b3f-' || lpad(v.cust::text,   12, '0'))::uuid end,
       case when v.folder is not null then ('21000000-7e5d-4c1a-9b3f-' || lpad(v.folder::text, 12, '0'))::uuid end,
       v.filename, v.doc_type, v.status, v.confidence, v.extracted_data::jsonb,
       'demo/docu/' || v.filename, null,
       nullif(v.entity_type, ''),
       case when v.entity_n is not null
            then (v.entity_group || '000000-7e5d-4c1a-9b3f-' || lpad(v.entity_n::text, 12, '0'))::uuid end,
       v.created_at::timestamptz
from (values
  -- Packaging, priced flat against doc 15 (21 Jul): R168.00 sleeve, R118.00 bundle.
  (911, 9, null::int, 901, 'helderberg-packaging-INV-9188.pdf', 'invoice', 'extracted', 91,
    '{"supplier":"Helderberg Packaging","fields":[{"label":"Supplier","value":"Helderberg Packaging","confidence":93},{"label":"Invoice number","value":"INV-9188","confidence":92},{"label":"Invoice date","value":"2026-08-18","confidence":92},{"label":"Total (incl. VAT)","value":"R 195 454.00","confidence":91},{"label":"VAT","value":"R 25 494.00","confidence":90}],"line_items":[{"description":"Punnets & Trays (sleeve)","quantity":"520","unit":"sleeve","unit_price":"168.00","amount":"87360.00","confidence":92},{"description":"Cartons - Standard (bundle)","quantity":"700","unit":"bundle","unit_price":"118.00","amount":"82600.00","confidence":91}]}',
    '', null, null::int, '2026-08-18T09:35:00+02'),
  -- Milling, priced flat against doc 13 (14 Jul): R132.00 / R118.00 / R42.00.
  (912, 6, null, 901, 'swartland-grain-INV-5241.pdf', 'invoice', 'extracted', 93,
    '{"supplier":"Swartland Grain & Mill","fields":[{"label":"Supplier","value":"Swartland Grain & Mill","confidence":95},{"label":"Invoice number","value":"INV-5241","confidence":94},{"label":"Invoice date","value":"2026-08-19","confidence":94},{"label":"Total (incl. VAT)","value":"R 358 432.00","confidence":93},{"label":"VAT","value":"R 46 752.00","confidence":92}],"line_items":[{"description":"Cake Flour (12.5kg bag)","quantity":"760","unit":"bag","unit_price":"132.00","amount":"100320.00","confidence":94},{"description":"Maize Meal (12.5kg bag)","quantity":"880","unit":"bag","unit_price":"118.00","amount":"103840.00","confidence":93},{"description":"Bread Rolls (24/bag)","quantity":"2560","unit":"bag","unit_price":"42.00","amount":"107520.00","confidence":92}]}',
    '', null, null, '2026-08-19T08:10:00+02'),
  -- The statement. `summary` is the block the statement-totals card and the
  -- reconciliation view read; the line items are in the SUPPLIER's raw wording
  -- (the confirmed pp_name_aliases of the seed's §12 resolve them back), and the
  -- opening balance is doc 25's closing balance to the cent, so the two
  -- statements read as one running account.
  --   406 100.00 − 410 000.00 + 438 000.00 − 3 100.00 + 3 900.00 + 2 100.00
  --   = 437 000.00
  (913, 1, null, 3, 'bergriver-growers-STMT-2026-07.pdf', 'statement', 'extracted', 92,
    '{"supplier":"Bergriver Growers","fields":[{"label":"Supplier","value":"Bergriver Growers","confidence":95},{"label":"Statement period","value":"July 2026","confidence":93},{"label":"Closing balance","value":"R 437 000.00","confidence":92}],"summary":{"statement_date":"31/JUL/2026","opening_balance":406100.00,"payments":-410000.00,"total_purchases":438000.00,"total_pallet_refunds":-3100.00,"total_pallet_usage":3900.00,"vat":57130.43,"total_charges":2100.00,"closing_balance":437000.00,"net_financial_transactions":30900.00,"audit_error":0.00},"line_items":[{"description":"SALAD LEAF MIX 5KG CRT","quantity":"1240","unit":"crate","unit_price":"147.00","amount":"182280.00","confidence":91},{"description":"SPINACH BABY 4KG","quantity":"980","unit":"crate","unit_price":"131.00","amount":"128380.00","confidence":90},{"description":"PALLET DEPOSIT","quantity":"44","unit":"pallet","unit_price":"70.00","amount":"3080.00","confidence":86}]}',
    '', null, null, '2026-08-18T08:05:00+02'),
  -- The flagged one. A first-time supplier, a bad scan: every field confidence
  -- is in the 40s-60s, well under DOC_LOW_CONFIDENCE_THRESHOLD (80), and the
  -- status is 'error' so `commitDocument` will not touch it — which is exactly
  -- why the Review chain offers no Approve on this row. Left UNFILED (folder
  -- null): nobody files a document Vyso could not read.
  (914, 12, null, null, 'peninsula-beverage-INV-3077.pdf', 'invoice', 'error', 58,
    '{"supplier":"Peninsula Beverage Supply","fields":[{"label":"Supplier","value":"Peninsula Beverage Supply","confidence":62},{"label":"Invoice number","value":"INV-3077","confidence":55},{"label":"Invoice date","value":"2026-08-19","confidence":51},{"label":"Total (incl. VAT)","value":"R 86 721.50","confidence":46},{"label":"VAT","value":"R 11 311.50","confidence":44}],"line_items":[{"description":"Bottled Water (12x1.5L case)","quantity":"420","unit":"case","unit_price":"96.50","amount":"40530.00","confidence":57},{"description":"Fruit Juice Concentrate (5L)","quantity":"160","unit":"bottle","unit_price":"218.00","amount":"34880.00","confidence":49}]}',
    '', null, null, '2026-08-19T07:55:00+02')
) as v(n, sup, cust, folder, filename, doc_type, status, confidence, extracted_data,
       entity_type, entity_group, entity_n, created_at);


-- ##########################################################################
-- ##  SECTION 2 — ORDERFLOW: two website enquiries awaiting a quote
-- ##########################################################################
--
-- THE QUEUE'S PREDICATE IS THE ORDERFLOW DASHBOARD'S, not the Quotes screen's:
-- `status='new' AND flagged_spam=false` (lib/platform/review-queue.ts, source 2).
-- Both rows below satisfy it. `flagged_spam` is written explicitly rather than
-- left to the column default, because the whole point of these two rows is that
-- they are real leads and a default is not a statement.
--
-- `email_ingest_id` STAYS NULL. It is a FK to `email_ingests` and carries a
-- partial unique index; a demo row does not get to claim an inbound email that
-- never arrived, and NULL is excluded from that index so nothing collides.
--
-- `customer_id` and `quote_id` STAY NULL. The schema is explicit that
-- customer_id is "set BY A HUMAN" — and on this demo, the human is the prospect
-- pressing "Add as new customer" on camera. Pre-linking row 912 would take the
-- button away, which is the shot.
--
-- Every text field here is untrusted free text by design (a public form). It is
-- rendered verbatim as TEXT by QuoteReviewPane and matched on by nothing except
-- the courtesy duplicate check.
-- ---------------------------------------------------------------------------
insert into of_quote_requests (
  id, org_id, source, email_ingest_id, from_email, contact_name, contact_email,
  contact_phone, business_name, message, requested_items, status, flagged_spam,
  quote_id, customer_id, received_at, created_at, updated_at)
select
  ('41000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  'email', null, 'forms@meridianfood.co.za',
  v.contact_name, v.contact_email, v.contact_phone, v.business_name, v.message,
  v.items::jsonb, 'new', false,
  null, null,
  v.received_at::timestamptz, v.received_at::timestamptz, v.received_at::timestamptz
from (values
  -- ALREADY A CUSTOMER. The address is of_customers #1's, byte for byte.
  (911, 'Elmarie van Wyk', 'orders@bolandtrading.co.za', '021 872 4410', 'Boland Trading Co.',
   'Hi team — please quote the Bellville depot for a September standing order: 120 crates of mixed salad leaf and 80 crates of baby spinach, weekly, on the delivery days we run now. Regards, Elmarie',
   '[{"description":"Mixed salad leaf (crate)","quantity":120,"unit":"crate"},{"description":"Baby spinach (crate)","quantity":80,"unit":"crate"}]',
   '2026-08-18T16:42:00+02'),
  -- NEW PROSPECT. No customer matches this email, and "Karoo Function Hire"
  -- normalises to nothing in of_customers either.
  (912, 'Thandi Mokoena', 'thandi@karoofunctionhire.co.za', '+27 82 447 1130', 'Karoo Function Hire',
   'Good morning — we cater private functions in the Karoo and around the winelands. I need a price for 40 tubs of prepared salad mix and 20 kg of line fish fillet, delivered to Stellenbosch for a function on Saturday 29 August. Please also send your standing price list. Thank you. Thandi',
   '[{"description":"Prepared salad mix (2kg tub)","quantity":40,"unit":"tub"},{"description":"Line fish fillet","quantity":20,"unit":"kg"}]',
   '2026-08-19T07:18:00+02')
) as v(n, contact_name, contact_email, contact_phone, business_name, message, items, received_at);


-- ##########################################################################
-- ##  SECTION 3 — QUIETEN THE SEED'S BACKLOG
-- ##########################################################################
--
-- READ THIS BEFORE YOU RUN IT. These three UPDATEs touch rows THIS FILE DID NOT
-- WRITE — the only place in the 08/08b pair that does — and they are what make
-- the Review queue read 6 instead of 30.
--
-- WHY IT IS NECESSARY. The queue is COMPUTED, never stored
-- (lib/platform/review-queue.ts, rule 3): it is `documents` where
-- `status in ('extracted','pending','error')` union `of_quote_requests` where
-- `status='new' and flagged_spam=false`. `demo-all-in-one.sql` §15 seeds 20
-- extracted + 2 pending + 2 error documents and §13 seeds 6 `new` quote
-- requests, all of them deliberately, for Doc-U's and OrderFlow's own KPI
-- surfaces — which predate Review by months. Nothing is wrong with those rows;
-- they simply all mean "waiting on a human" to a feature that did not exist when
-- they were written.
--
-- WHY THESE STATUSES.
--   extracted → 'reviewed'  A read document somebody has now looked at. It stays
--                           a price source (EXCLUDED_STATUSES is {rejected,
--                           archived}) and stays in SupplySync's supplier feed
--                           (supplysync-data.ts excludes rejected/archived/error),
--                           so no number anywhere else moves.
--   pending   → 'archived'  Docs 23 and 29 have NO extracted_data. "Reviewed"
--                           would be a claim about a document nothing has read;
--                           archived is the honest one, and it is Doc-U's own
--                           soft-hide.
--   error     → 'archived'  Docs 16 and 34. Same reasoning, and it leaves
--                           exactly one row in "Flagged — Vyso could not read
--                           these": the one the Loom points at.
--   new       → 'dismissed' The Quotes screen server-filters to 'new', so the
--                           six July enquiries simply leave the screen. Not
--                           'quoted': that would imply a QTE- document that was
--                           never issued, and quote_id is null on all six.
--
-- SCOPE. `…-0000000000%` pins the counter to 0-99. The seed's are 1-34
-- (documents) and 1-6 (quote requests); 08's are 901-906 and this file's are
-- 911-914, all of which begin `…09`, so none can be matched. Documents created
-- by a real upload carry a gen_random_uuid() and match nothing here.
--
-- REVERSIBLE. `docs/demo-runbook.md` §"08b refresh" carries the UPDATE that puts
-- all of them back.
-- ---------------------------------------------------------------------------

update documents
   set status = 'reviewed'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text like '20000000-7e5d-4c1a-9b3f-0000000000%'
   and status = 'extracted';

update documents
   set status = 'archived',
       archived_at = timestamptz '2026-08-17 18:00+02'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text like '20000000-7e5d-4c1a-9b3f-0000000000%'
   and status in ('pending', 'error');

update of_quote_requests
   set status = 'dismissed',
       updated_at = timestamptz '2026-08-17 18:00+02'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text like '41000000-7e5d-4c1a-9b3f-0000000000%'
   and status = 'new';


-- ##########################################################################
-- ##  SECTION 4 — VERIFICATION (read-only; nothing below writes)
-- ##  Run these after the file. All four must match, or do not record.
-- ##########################################################################

-- 4.1  DOCUMENTS AWAITING A DECISION — the queue's own predicate, including the
--      claim guard. Expect exactly 3 rows: 911, 912, 913 (extracted) and 914
--      (error) — i.e. two lines, `error 1` and `extracted 3`.
select d.status, count(*) as n
  from documents d
 where d.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and d.status in ('extracted', 'pending', 'error')
   and d.approved_at is null
 group by d.status
 order by d.status;

-- 4.2  …and which ones they are. Expect exactly these four filenames, newest
--      first: swartland-grain-INV-5241, peninsula-beverage-INV-3077,
--      helderberg-packaging-INV-9188, bergriver-growers-STMT-2026-07.
select d.filename,
       d.document_type,
       d.status,
       d.confidence,
       s.name as supplier,
       d.storage_path,
       d.created_at
  from documents d
  left join suppliers s on s.id = d.supplier_id
 where d.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and d.status in ('extracted', 'pending', 'error')
   and d.approved_at is null
 order by d.created_at desc;

-- 4.3  QUOTE REQUESTS AWAITING A QUOTE — expect exactly 2, and expect the
--      `already_a_customer` column to read `Boland Trading Co.` on one and NULL
--      on the other. That column is the same email match
--      `findExistingCustomer()` runs, so if it is NULL on both, the "Add as new
--      customer" beat will not show the disabled state and the shot is dead.
select q.contact_name,
       q.business_name,
       q.contact_email,
       q.status,
       q.flagged_spam,
       jsonb_array_length(q.requested_items) as lines_requested,
       c.name as already_a_customer,
       q.received_at
  from of_quote_requests q
  left join of_customers c
    on c.org_id = q.org_id
   and lower(trim(c.email)) = lower(trim(q.contact_email))
 where q.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and q.status = 'new'
   and q.flagged_spam = false
 order by q.received_at desc;

-- 4.4  THE WHOLE QUEUE, THE WAY THE RAIL'S DOT COUNTS IT. Expect 6 — and expect
--      the four task groups the Loom names, in this order down the chain:
--      Doc-U invoices 2, Doc-U statements 1, Doc-U flagged 1, OrderFlow quotes 2.
select 'docu:invoices' as task, count(*) as n
  from documents
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and status in ('extracted', 'pending') and approved_at is null
   and document_type <> 'statement'
union all
select 'docu:statements', count(*)
  from documents
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and status in ('extracted', 'pending') and approved_at is null
   and document_type = 'statement'
union all
select 'docu:flagged', count(*)
  from documents
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and status = 'error'
union all
select 'orderflow:quotes', count(*)
  from of_quote_requests
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and status = 'new' and flagged_spam = false;
