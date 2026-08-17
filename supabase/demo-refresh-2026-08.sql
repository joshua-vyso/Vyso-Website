-- ############################################################################
-- ##
-- ##  MERIDIAN FOOD CO.  —  AUGUST 2026 REFRESH
-- ##  supabase/demo-refresh-2026-08.sql   ·   written 2026-08-17
-- ##
-- ############################################################################
--
-- WHAT THIS IS
--   A small, additive follow-on to `supabase/demo-all-in-one.sql`. That file
--   builds the whole Meridian demo workspace but stops on 2026-07-24 (documents)
--   / 2026-07-29 (orders, movements, waste). Three weeks later every MTD KPI
--   reads empty and Price Watch would say "last seen 24 days ago". This file
--   carries the story forward to today, 2026-08-17, so The Brief opens on real
--   findings the moment a prospect logs in.
--
-- PREREQUISITE
--   `supabase/demo-all-in-one.sql` MUST already be applied. Every id this file
--   references that it does not itself create is a blueprint id from that file
--   (listed under "SEED IDS REFERENCED" below). Nothing here creates a table,
--   alters one, or drops anything.
--
-- HOW TO APPLY
--   Paste the whole file into the Supabase SQL editor and run it once.
--   IDEMPOTENT and RE-RUNNABLE: section 0 deletes exactly the rows this file
--   writes — never `delete ... where org_id = <meridian>` on its own, always
--   org + an explicit id-range predicate in the 9xx/9xxx counter block that the
--   seed's own counters (1-490) can never reach. Re-running it twice leaves the
--   database identical.
--
--   The Supabase SQL editor runs a pasted script as ONE transaction, so a
--   failure anywhere rolls the whole thing back. Nothing here depends on
--   partial state from an earlier attempt: section 0 clears this file's own id
--   block before anything is written, and no statement reads a row another
--   statement in this file might or might not have left behind.
--
-- ============================================================================
-- WRITTEN FOR A *LIVE* MERIDIAN, NOT A FRESHLY SEEDED ONE  (2026-08-17 fix)
-- ============================================================================
--   The first attempt at this file died on:
--     ERROR 22P02: invalid input syntax for type integer: "2ee677036c2a"
--
--   demo-all-in-one.sql recovers a row's blueprint counter by slicing the
--   numeric tail off its UUID — `substr(id::text, 25)::int`. That is sound
--   against an org whose every row it just wrote itself. It is NOT sound
--   against prod: Meridian has been open in the app since July, so
--   pp_stock_items, documents, of_invoices, agent_findings and pw_* all hold
--   rows created with gen_random_uuid(), whose tail is hex ("2ee677036c2a")
--   and is not an integer.
--
--   A WHERE clause does not save you. PostgreSQL is free to evaluate a target
--   list before (or alongside) the qual that would have excluded the offending
--   row, so the only safe move is to remove the cast, not to guard it. Every
--   such site in this file has been rewritten to one of:
--     * a TEXT pattern      — `id::text like 'GG000000-7e5d-4c1a-9b3f-0000000009%'`
--     * a BUILT id          — join `generate_series(1, 32)` / this file's own
--                             literal order list and construct the uuid from the
--                             counter, so the counter is known before the row is
--                             read rather than parsed out of it
--     * a window function   — row_number() where a line number was wanted
--   The scripted check that keeps it that way greps for a numeric cast applied
--   to anything id-derived and must report zero hits.
--
--   HEADS UP FOR ANYONE RE-RUNNING THE SEED (plan step B2 offers this):
--   demo-all-in-one.sql still contains 14 such casts of its own. On a live
--   Meridian it will very likely fail the same way. It has NOT been changed
--   here — this file is not allowed to touch it — but do not assume it is
--   safe to re-run against prod just because this one is.
--
-- CONVENTIONS (inherited verbatim from demo-all-in-one.sql)
--   * All money in ZAR.
--   * Every row carries a deterministic UUID `GG000000-7e5d-4c1a-9b3f-NNNNNNNNNNNN`
--     with the seed's group codes (20 = documents, 21 = folders, 0a = orders,
--     0b = order lines, 0c = invoices, 0d = invoice lines, 0e = payments,
--     19 = stock movements, 30 = waste events). NEW counters only:
--       documents/folders  901-906      (seed used 1-34 / 1-6)
--       orders/invoices    9001-9050    (seed used 1-490)
--       order/inv. lines   90011-90505  (seed used 11-4905)
--       payments           9001-9050 and 509001-509050 (seed 1-490 / 500001-500490)
--       stock movements    9001-9192, 9301-9302  (seed used 1-256)
--       waste events       9001-9038    (seed used 1-336)
--   * `insert ... select ... from (values ...)` everywhere a row set is literal.
--   * No gen_random_uuid(), no `create table`, no `alter`, no `drop`.
--
-- ============================================================================
-- STATIC VERIFICATION  (computed from the INSERT values in this file)
-- ============================================================================
--
-- 1. REVENUE BY MONTH  (of_order_items sum(qty x unit_price) over of_orders
--    whose status is 'invoiced' or 'paid' — the definition planwise-data.ts:103
--    and pricepilot use)
--
--      month     seed        this file    total
--      2026-04   5 150 000           0    5 150 000
--      2026-05   5 480 000           0    5 480 000
--      2026-06   5 860 000     271 000    6 131 000
--      2026-07   5 155 000      42 000    5 197 000
--      2026-08           0   2 800 000    2 800 000   <- MTD to Mon 17 Aug
--
--    The June/July additions are the five late-payer invoices (§2.6): they have
--    to be dated where their DUE dates land, and a >= 30-day-overdue invoice on
--    30-day terms is by definition a June invoice. §2.3's reconciliation forces
--    each order's lines to sum EXACTLY to its planned amount, so the August
--    column is 2 800 000.00 to the cent, not "about".
--
-- 2. PRICE WATCH SERIES  (verified by running the real
--    lib/platform/price-watch/{normalize,detect}.ts over seed points + these
--    points; median = trailing 60 days of PRIOR points only, relative to the
--    latest point's date — detect.ts:330-338)
--
--    (a) RISING — fires a finding on/after 2026-08-17
--
--    Winelands Protein Co. / "Line fish fillet"  (kg, basis weight_unit)
--      2026-06-05  R148.00 x 380kg   2026-06-27  R152.00 x 400kg
--      2026-07-19  R168.00 x 420kg   2026-08-12  R176.00 x 440kg   <- NEW (doc 901)
--      trailing-60d median of priors in window (152, 168) = R160.00
--      delta = +10.0 %   annual units 8 803 kg   rand impact R140 848
--
--    Riebeek Oils & Fats / "Cooking oil (5L)"  (case, basis count)
--      2026-06-08  R558.00 x 240     2026-06-30  R566.00 x 260
--      2026-07-22  R640.00 x 280     2026-08-13  R664.00 x 290     <- NEW (doc 902)
--      median of (566, 640) = R603.00
--      delta = +10.1 %   annual units 5 917 cases   rand impact R360 937
--
--    Overberg Dairy Supply / "Cheese block"  (kg, basis weight_unit)
--      2026-06-10  R122.00 x 640kg   2026-07-02  R125.00 x 680kg
--      2026-07-24  R138.00 x 700kg   2026-08-14  R146.00 x 720kg   <- NEW (doc 903)
--      median of (125, 138) = R131.50
--      delta = +11.0 %   annual units 15 386 kg   rand impact R223 097
--
--    (b) FALLING — must NOT fire (detect.ts only reports increases)
--
--    Cape Cold Chain Supply / "Prepared Salad Mix (2kg tub)"  (tub, basis count)
--      2026-06-19  R80.00 x 540   <- NEW (doc 904)
--      2026-07-18  R78.00 x 560   (seed doc 14)
--      2026-08-06  R77.50 x 550   <- NEW (doc 905)
--      2026-08-15  R76.80 x 560   <- NEW (doc 906)
--      median of (80.00, 78.00, 77.50) = R78.00   delta = -1.5 %   no finding.
--      End to end: -4.0 %. This is the series the chat's price-history tool
--      uses to say "and Cape Cold Chain came DOWN — leave them alone".
--
--    THE TRAP THIS FILE AVOIDS. Adding several August invoices at the JULY
--    price would have pushed each series' trailing median UP and SUPPRESSED the
--    finding it was meant to strengthen. So each rising supplier gets exactly
--    ONE new invoice, priced above the trailing median by more than the 8 %
--    floor — the "second increase in six weeks" the Brief tells.
--
--    THE COMPANION LINES ON THE SAME INVOICES ARE DELIBERATELY QUIET.
--    Chicken portions (R620 -> R624, +4.2 % vs median 599), Frying medium 20L
--    (R1 302 -> R1 308, +5.4 % vs 1 241) and Butter blocks (R445 -> R446,
--    +3.2 % vs 432) all settle below the 8 % floor. Without a new point those
--    three series would have kept their July jump as "latest" and fired two
--    extra findings (chicken R533 568, frying medium R147 686), leaving the
--    Brief with five price findings instead of the three the demo tells.
--
--    OPERATOR NOTE. If the Price Watch agent has ALREADY run against the seed
--    alone, chicken portions and frying medium will each have an OPEN
--    agent_findings row. detect.ts suppresses a re-fire but never retracts, so
--    those two stay on the Brief. Dismiss them by hand in the UI after applying
--    this file. This file deliberately does not delete agent_findings: those
--    rows are the agent's own work, not seed data, and a blanket delete here
--    would silently throw away a real run's output.
--
-- 3. DEBTORS  (effectiveInvoiceStatus, lib/platform/orderflow.ts:566 —
--    an unpaid invoice past its due_date reads 'overdue' whatever the stored
--    status says; a PART payment outranks overdue, so none of these five carry
--    one)
--
--      invoice     customer                    total incl VAT   due          days late
--      INV-13187   Northern Suburbs Supply     R101 200.00      2026-07-08      40
--      INV-13188   Northern Suburbs Supply      R89 700.00      2026-07-16      32
--      INV-13189   Swartland Trade Co.          R64 400.00      2026-07-11      37
--      INV-13190   Swartland Trade Co.          R56 350.00      2026-07-17      31
--      INV-13191   Rooiberg Function Services   R48 300.00      2026-07-15      33
--
--      Repeat offender: Northern Suburbs Supply, R190 900.00 across 2 invoices,
--      oldest 40 days past terms — the "X owes you R190k" card.
--      Three customers, five invoices, all >= 30 days. These ADD to the seed's
--      own 8 stale June invoices (~R0.44M), so outstandingByCustomer() will show
--      more than three names; Northern Suburbs Supply is the worst by days late.
--
-- 4. STOCK  (pp_stock_items.on_hand is a STORED column — procurepulse-queries.ts
--    fetchStock() reads it directly and never sums pp_movements, so the ledger
--    rows in §3.1 are the audit trail and §3.2 is what the KPIs actually read)
--
--      item 13 Chicken Portions (10kg box)  on_hand 86 -> 72   count_adjustment -14
--              (-12 % of the 114 boxes received in August; R8 680 at cost)
--      item 25 Cheese Block (kg)            on_hand 96 -> 86   count_adjustment -10
--              (-8 % of the 130 kg received in August; R1 380 at cost)
--      item 21 Cooking Oil (4x5L case)      on_hand 58 -> 12   low_threshold 16
--              -> falls BELOW its pp_stock_thresholds minimum, so ProcurePulse
--              and InsightGen both flag it. Same supplier as the +10.1 % price
--              finding: "you are about to reorder oil from the supplier who
--              just put you up 10 %."
--
-- 5. SEED IDS REFERENCED BY THIS FILE (all created by demo-all-in-one.sql)
--      organisations       01000000-7e5d-4c1a-9b3f-000000000001  (Meridian)
--      suppliers    (04)   3 Cape Cold Chain Supply · 4 Winelands Protein Co.
--                          7 Riebeek Oils & Fats · 8 Overberg Dairy Supply
--      of_customers (05)   1,2,3,4,5,6,7,8,9,10,11,12 (trade)
--                          13,14,15,16 (events) · 20,21,22,23,24 (counter)
--                          25,26,27,28 (farm gate)
--      cd_delivery_addresses (3b)  (cust_idx * 10 + 1) for each of the above
--      pp_stock_items (02) all 32 (movements) · 13, 21, 25 (level updates)
--      pp_stock_thresholds (1d)    21 (low_threshold 16, the minimum breached)
--      sb_roster_shifts   (2a)     1-45 (week label only)
--      sb_shift_swaps     (2d)     1-3  (week label only)
--      documents          (20)     14 (Cape Cold Chain July invoice — the
--                                  middle point of the falling series)
--      ww_waste_categories (2e) / ww_devices (2f) are joined BY NAME, not by id
--      (ww_waste_events.category / .device are denormalised text) — the strings
--      below are byte-identical to those rows.
--
-- KNOWN, DELIBERATE NON-CHANGES
--   * pp_stock_items.avg_unit_price / price_history are NOT touched. The seed
--     pins "last price_history point == avg_unit_price" because PricePilot's
--     detectCostSpikes() appends the live cost otherwise, and the exact count of
--     STEP/CREEP spikes is load-bearing there. Price Watch reads `documents`,
--     not the catalogue, so the three price findings do not need it.
--   * pp_stock_thresholds is NOT touched: its low_threshold must stay equal to
--     the item's own low_threshold or ProcurePulse and InsightGen disagree about
--     which lines are low.
--   * sb_attendance gets no new rows. It has NO date column — getShiftBoardData
--     (shiftboard-data.ts:135) reads every row for the org as "today", so extra
--     rows would render each employee twice rather than reading as a new day.
--     Same reason sb_roster_shifts gets a label update instead of 45 more rows.
--   * storage_path follows the seed's 'demo/docu/<filename>' convention. NOTE
--     (observation, not a fix): no object is uploaded for any seed document
--     either, so Doc-U's file preview will 404 for all 34 seed documents and
--     these 6 alike. Everything else on the document page is driven by
--     extracted_data and works.
-- ############################################################################


-- ##########################################################################
-- ##  SECTION 0 — DELETE PREAMBLE
-- ##  Scoped to the Meridian org AND to the id block this file owns.
-- ##  Children before parents. Nothing the seed wrote is ever matched:
-- ##  every predicate below requires the counter to be in the 9xx/9xxx range,
-- ##  and the seed's highest counter in each group is 490 (orders), 4905
-- ##  (order lines), 336 (waste), 256 (movements), 34 (documents).
-- ##########################################################################

delete from of_payments      where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and (id::text like '0e000000-7e5d-4c1a-9b3f-000000009%' or id::text like '0e000000-7e5d-4c1a-9b3f-000000509%');
delete from of_invoice_items where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '0d000000-7e5d-4c1a-9b3f-00000009%';
delete from of_order_items   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '0b000000-7e5d-4c1a-9b3f-00000009%';
-- of_orders.invoice_id points at the invoice, so the link is dropped before the
-- invoice row it references (the FK is ON DELETE SET NULL, but relying on that
-- would leave the outcome dependent on a live schema this file cannot see).
update of_orders set invoice_id = null
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text like '0a000000-7e5d-4c1a-9b3f-000000009%';
delete from of_invoices      where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '0c000000-7e5d-4c1a-9b3f-000000009%';
delete from of_orders        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '0a000000-7e5d-4c1a-9b3f-000000009%';
delete from documents        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '20000000-7e5d-4c1a-9b3f-0000000009%';
delete from document_folders where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '21000000-7e5d-4c1a-9b3f-0000000009%';
delete from pp_movements     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '19000000-7e5d-4c1a-9b3f-000000009%';
delete from ww_waste_events  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '30000000-7e5d-4c1a-9b3f-000000009%';


-- ##########################################################################
-- ##  SECTION 1 — DOC-U: the August supplier invoices
-- ##########################################################################

-- ---------------------------------------------------------------------------
-- 1.1  One new filing folder (`document_folders`, group 21, id 901).
--      The seed's folder 1 is literally named "Supplier invoices — July", so
--      filing August paper in it would be wrong on screen. Same colour as the
--      July folder (a member of FOLDER_COLORS in lib/platform/docu/folders.ts)
--      and starred, so it sits beside it in the folder grid rather than reading
--      as a different kind of thing.
-- ---------------------------------------------------------------------------
insert into document_folders (id, org_id, name, color, starred, created_by)
select ('21000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.color, v.starred, null
from (values
  (901, 'Supplier invoices — August', '#0C447C', true)
) as v(n, name, color, starred);


-- ---------------------------------------------------------------------------
-- 1.2  Six supplier invoices (`documents`, group 20, ids 901-906).
--
--      SAME SHAPE AS THE SEED'S DOCS 1-9, because run.ts:828-871 reads exactly
--      this shape: `supplier`, `fields[]` carrying "Invoice date" (the label
--      resolveDocumentDate() matches first for an invoice), and `line_items[]`
--      with description / quantity / unit / unit_price / amount.
--
--      THE DESCRIPTIONS ARE BYTE-IDENTICAL to the seed's. That is what makes
--      pw_item_matches resolve each new line to the SAME canonical pw_item as
--      its June/July predecessors instead of opening a second review row and a
--      second, one-point price series — the whole point of the exercise.
--
--      status is 'reviewed'/'approved' only: run.ts's EXCLUDED_STATUSES drops
--      rejected/archived, and a `pending` document has no line items to read.
--      `created_at` IS the invoice date (not "now"), so the Doc-U list, the
--      supplier feed and the price series all agree about when the paper landed.
--
--      Amounts are ex-VAT per line; "Total (incl. VAT)" = sum x 1.15, exactly
--      as docs 1-9 do it.
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
  -- Fish fillet R168 -> R176 (+10.0 % on the trailing median). Chicken settles
  -- at R624 so it does NOT fire a second Winelands finding.
  (901, 4, null::int, 901, 'winelands-protein-INV-9268.pdf', 'invoice', 'reviewed', 95,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":96},{"label":"Invoice number","value":"INV-9268","confidence":96},{"label":"Invoice date","value":"2026-08-12","confidence":96},{"label":"Total (incl. VAT)","value":"R 447 856.00","confidence":95},{"label":"VAT","value":"R 58 416.00","confidence":94}],"line_items":[{"description":"Line fish fillet","quantity":"440","unit":"kg","unit_price":"176.00","amount":"77440.00","confidence":96},{"description":"Chicken portions","quantity":"500","unit":"box","unit_price":"624.00","amount":"312000.00","confidence":95}]}',
    '', null, null::int, '2026-08-12T07:45:00+02'),
  -- Cooking oil R640 -> R664 (+10.1 %). Frying medium holds at R1 308.
  (902, 7, null, 901, 'riebeek-oils-INV-4559.pdf', 'invoice', 'approved', 95,
    '{"supplier":"Riebeek Oils & Fats","fields":[{"label":"Supplier","value":"Riebeek Oils & Fats","confidence":96},{"label":"Invoice number","value":"INV-4559","confidence":96},{"label":"Invoice date","value":"2026-08-13","confidence":96},{"label":"Total (incl. VAT)","value":"R 290 637.20","confidence":95},{"label":"VAT","value":"R 37 909.20","confidence":94}],"line_items":[{"description":"Cooking oil (5L)","quantity":"290","unit":"case","unit_price":"664.00","amount":"192560.00","confidence":96},{"description":"Frying medium (20L)","quantity":"46","unit":"drum","unit_price":"1308.00","amount":"60168.00","confidence":95}]}',
    '', null, null, '2026-08-13T09:20:00+02'),
  -- Cheese block R138 -> R146 (+11.0 %). Butter holds at R446.
  (903, 8, null, 901, 'overberg-dairy-INV-2516.pdf', 'invoice', 'reviewed', 96,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":97},{"label":"Invoice number","value":"INV-2516","confidence":97},{"label":"Invoice date","value":"2026-08-14","confidence":97},{"label":"Total (incl. VAT)","value":"R 236 290.50","confidence":96},{"label":"VAT","value":"R 30 820.50","confidence":95}],"line_items":[{"description":"Cheese block","quantity":"720","unit":"kg","unit_price":"146.00","amount":"105120.00","confidence":97},{"description":"Butter blocks","quantity":"225","unit":"case","unit_price":"446.00","amount":"100350.00","confidence":96}]}',
    '', null, null, '2026-08-14T10:15:00+02'),
  -- The FALLING series. Doc 904 is dated JUNE on purpose: it is the point that
  -- turns the seed's single July observation into a real history, so the chat
  -- can show a four-point line going down. Prepared Veg Mix is held flat at
  -- R82.00 across all three so it contributes no move in either direction.
  (904, 3, null, 901, 'cape-cold-chain-INV-1224.pdf', 'invoice', 'reviewed', 91,
    '{"supplier":"Cape Cold Chain Supply","fields":[{"label":"Supplier","value":"Cape Cold Chain Supply","confidence":93},{"label":"Invoice number","value":"INV-1224","confidence":92},{"label":"Invoice date","value":"2026-06-19","confidence":92},{"label":"Total (incl. VAT)","value":"R 98 716.00","confidence":91},{"label":"VAT","value":"R 12 876.00","confidence":90}],"line_items":[{"description":"Prepared Salad Mix (2kg tub)","quantity":"540","unit":"tub","unit_price":"80.00","amount":"43200.00","confidence":92},{"description":"Prepared Veg Mix (2.5kg tub)","quantity":"520","unit":"tub","unit_price":"82.00","amount":"42640.00","confidence":91}]}',
    '', null, null, '2026-06-19T12:40:00+02'),
  (905, 3, null, 901, 'cape-cold-chain-INV-1302.pdf', 'invoice', 'approved', 93,
    '{"supplier":"Cape Cold Chain Supply","fields":[{"label":"Supplier","value":"Cape Cold Chain Supply","confidence":95},{"label":"Invoice number","value":"INV-1302","confidence":94},{"label":"Invoice date","value":"2026-08-06","confidence":94},{"label":"Total (incl. VAT)","value":"R 98 997.75","confidence":93},{"label":"VAT","value":"R 12 912.75","confidence":92}],"line_items":[{"description":"Prepared Salad Mix (2kg tub)","quantity":"550","unit":"tub","unit_price":"77.50","amount":"42625.00","confidence":94},{"description":"Prepared Veg Mix (2.5kg tub)","quantity":"530","unit":"tub","unit_price":"82.00","amount":"43460.00","confidence":93}]}',
    '', null, null, '2026-08-06T12:25:00+02'),
  (906, 3, null, 901, 'cape-cold-chain-INV-1341.pdf', 'invoice', 'reviewed', 94,
    '{"supplier":"Cape Cold Chain Supply","fields":[{"label":"Supplier","value":"Cape Cold Chain Supply","confidence":95},{"label":"Invoice number","value":"INV-1341","confidence":95},{"label":"Invoice date","value":"2026-08-15","confidence":95},{"label":"Total (incl. VAT)","value":"R 100 381.20","confidence":94},{"label":"VAT","value":"R 13 093.20","confidence":93}],"line_items":[{"description":"Prepared Salad Mix (2kg tub)","quantity":"560","unit":"tub","unit_price":"76.80","amount":"43008.00","confidence":95},{"description":"Prepared Veg Mix (2.5kg tub)","quantity":"540","unit":"tub","unit_price":"82.00","amount":"44280.00","confidence":94}]}',
    '', null, null, '2026-08-15T12:10:00+02')
) as v(n, sup, cust, folder, filename, doc_type, status, confidence, extracted_data,
       entity_type, entity_group, entity_n, created_at);


-- ##########################################################################
-- ##  SECTION 2 — ORDERFLOW: August trading + the late payers
-- ##########################################################################
--
-- 50 new orders in one deliberate list rather than the seed's golden-ratio
-- generator, because two of the requirements here are about SPECIFIC rows
-- (which customer is late, and by how many days) and a generator cannot express
-- that without becoming a lookup table anyway. The August amounts were still
-- produced BY that generator (frac(k x 0.618...) scaled into each segment's
-- band, normalised so the group sums exactly) and then frozen as literals — so
-- the individual orders still look hand-made and the month still totals to the
-- rand.
--
--   9001-9021  wholesale, R1 626 800   9022-9026  catering, R559 400
--   9027-9040  counter,   R361 200     9041-9045  farm gate, R252 600
--                                      -> August MTD R2 800 000
--   9046-9050  the five late payers (June/July — see the header, §3)
--
-- HARD RULE 3 of the seed still holds: only 'invoiced'/'paid' count as revenue,
-- and all 50 are one or the other. Trading days are Mon-Sat; the last order of
-- every segment lands on Mon 2026-08-17 (today) so ShiftBoard's week-sales
-- strip — getWeekSales() reads only the CURRENT Mon-Sun week — is not empty.
-- Counter accounts get one consolidated till batch per trading day, and no
-- counter or farm-gate order is left open (a till batch does not sit on the
-- debtors book).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2.1  ORDERS (group 0a, counter = order index).
-- ---------------------------------------------------------------------------
insert into of_orders (
  id, org_id, customer_id, status, invoice_number, order_number, notes,
  customer_po, delivery_address, delivery_address_id, delivery_instructions,
  delivery_date, created_at, updated_at)
with src(idx, cust_idx, order_date, amount, order_status, invoice_status) as (values
  (9001::int,  1::int, date '2026-08-01',   86799::numeric, 'paid',  'paid'),
  (9002,  2, date '2026-08-01',   52971, 'paid',  'paid'),
  (9003,  3, date '2026-08-03',  107705, 'paid',  'paid'),
  (9004,  1, date '2026-08-03',   73878, 'paid',  'paid'),
  (9005,  4, date '2026-08-04',   40051, 'paid',  'paid'),
  (9006,  5, date '2026-08-05',   94784, 'paid',  'paid'),
  (9007,  2, date '2026-08-05',   60957, 'paid',  'paid'),
  (9008,  6, date '2026-08-06',  115691, 'paid',  'paid'),
  (9009,  1, date '2026-08-07',   81863, 'paid',  'paid'),
  (9010,  7, date '2026-08-07',   48036, 'paid',  'paid'),
  (9011,  3, date '2026-08-08',  102770, 'paid',  'paid'),
  (9012,  8, date '2026-08-10',   68943, 'invoiced',  'partially_paid'),
  (9013,  2, date '2026-08-10',   35115, 'invoiced',  'partially_paid'),
  (9014,  9, date '2026-08-11',   89849, 'invoiced',  'partially_paid'),
  (9015,  4, date '2026-08-12',   56022, 'invoiced',  'viewed'),
  (9016, 10, date '2026-08-12',  110755, 'invoiced',  'viewed'),
  (9017,  1, date '2026-08-13',   76928, 'invoiced',  'sent'),
  (9018, 11, date '2026-08-14',   43101, 'invoiced',  'sent'),
  (9019,  5, date '2026-08-14',   97834, 'invoiced',  'sent'),
  (9020, 12, date '2026-08-15',   64007, 'invoiced',  'sent'),
  (9021,  1, date '2026-08-17',  118741, 'invoiced',  'sent'),
  (9022, 13, date '2026-08-01',  135172, 'paid',  'paid'),
  (9023, 14, date '2026-08-05',   80901, 'paid',  'paid'),
  (9024, 15, date '2026-08-08',  168713, 'invoiced',  'partially_paid'),
  (9025, 13, date '2026-08-12',  114442, 'invoiced',  'viewed'),
  (9026, 16, date '2026-08-17',   60172, 'invoiced',  'sent'),
  (9027, 20, date '2026-08-01',   28278, 'paid',  'paid'),
  (9028, 21, date '2026-08-03',   20745, 'paid',  'paid'),
  (9029, 22, date '2026-08-04',   32934, 'paid',  'paid'),
  (9030, 23, date '2026-08-05',   25400, 'paid',  'paid'),
  (9031, 24, date '2026-08-06',   17867, 'paid',  'paid'),
  (9032, 20, date '2026-08-07',   30056, 'paid',  'paid'),
  (9033, 21, date '2026-08-08',   22523, 'paid',  'paid'),
  (9034, 22, date '2026-08-10',   34712, 'paid',  'paid'),
  (9035, 23, date '2026-08-11',   27179, 'paid',  'paid'),
  (9036, 24, date '2026-08-12',   19646, 'paid',  'paid'),
  (9037, 20, date '2026-08-13',   31834, 'paid',  'paid'),
  (9038, 21, date '2026-08-14',   24301, 'paid',  'paid'),
  (9039, 22, date '2026-08-15',   16768, 'paid',  'paid'),
  (9040, 23, date '2026-08-17',   28957, 'paid',  'paid'),
  (9041, 25, date '2026-08-01',   57756, 'paid',  'paid'),
  (9042, 26, date '2026-08-05',   40896, 'paid',  'paid'),
  (9043, 27, date '2026-08-08',   68175, 'paid',  'paid'),
  (9044, 28, date '2026-08-12',   51316, 'invoiced',  'viewed'),
  (9045, 25, date '2026-08-17',   34457, 'paid',  'paid'),
  (9046,  8, date '2026-06-08',   88000, 'invoiced',  'overdue'),
  (9047,  8, date '2026-06-16',   78000, 'invoiced',  'overdue'),
  (9048, 12, date '2026-06-11',   56000, 'invoiced',  'overdue'),
  (9049, 12, date '2026-06-17',   49000, 'invoiced',  'overdue'),
  (9050, 14, date '2026-07-01',   42000, 'invoiced',  'overdue')
),
placed as (
  select s.*,
         case when s.cust_idx <= 12 then 'wholesale'
              when s.cust_idx <= 19 then 'catering'
              when s.cust_idx <= 24 then 'counter'
              else 'farmgate' end as seg,
         -- same clock-spreading idiom as the seed, so two orders on one day do
         -- not share a timestamp and `order by created_at` is stable.
         ((s.order_date + time '06:30' + (((s.idx * 37) % 43) * interval '15 minutes'))::timestamp
            at time zone 'Africa/Johannesburg') as created_at
  from src s
)
select
  ('0a000000-7e5d-4c1a-9b3f-' || lpad(p.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  c.id,
  p.order_status,
  'INV-' || lpad((4141 + p.idx)::text, 4, '0'),
  'ORD-' || lpad((4609 + p.idx)::text, 4, '0'),
  case when p.seg = 'counter'
       then 'Consolidated counter batch for ' || to_char(p.order_date, 'DD Mon')
       else (array['Standing delivery — confirmed by phone',
                   'Split across two vehicles',
                   'Cold chain checked on dispatch',
                   'Collected at the depot',
                   'Priority account — dispatch first',
                   'Back-order line filled from the morning pick',
                   'Repeat of the previous week''s order',
                   'Pallet returns collected on delivery'])[((p.idx * 3) % 8) + 1] end,
  case when p.seg in ('wholesale', 'catering')
       then 'PO-' || to_char(p.order_date, 'YYMM') || '-' || lpad((p.idx % 1000)::text, 3, '0') end,
  c.billing_address,
  ('3b000000-7e5d-4c1a-9b3f-' || lpad((p.cust_idx * 10 + 1)::text, 12, '0'))::uuid,
  (array['Deliver before 09:00',
         'Receiving bay at the rear — ring the bell',
         'Call the receiver 20 minutes out',
         'Leave with the duty manager',
         'Signature required on the delivery note',
         'Cold chain checked on arrival'])[((p.idx * 5) % 6) + 1],
  case when p.seg in ('counter', 'farmgate') then p.order_date else p.order_date + 1 end,
  p.created_at,
  p.created_at
from placed p
join of_customers c
  on c.id = ('05000000-7e5d-4c1a-9b3f-' || lpad(p.cust_idx::text, 12, '0'))::uuid
 and c.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 2.2  ORDER LINES (group 0b, counter = order_index * 10 + line_no).
--      `prod` and `basket` are copied VERBATIM from demo-all-in-one.sql §5.
--      They must be: HARD RULE 1 there is that `unit_price` IS the catalogue
--      SELL price, which is what makes PricePilot's catalogue margin, PlanWise's
--      COGS and InsightGen's realized margin agree on 61.8 %. Inventing a price
--      for an August line would silently move the blended margin.
-- ---------------------------------------------------------------------------
insert into of_order_items (id, org_id, order_id, stock_item_id, name, qty, unit, unit_price, created_at)
with src(idx, cust_idx, order_date, amount, order_status, invoice_status) as (values
  (9001::int,  1::int, date '2026-08-01',   86799::numeric, 'paid',  'paid'),
  (9002,  2, date '2026-08-01',   52971, 'paid',  'paid'),
  (9003,  3, date '2026-08-03',  107705, 'paid',  'paid'),
  (9004,  1, date '2026-08-03',   73878, 'paid',  'paid'),
  (9005,  4, date '2026-08-04',   40051, 'paid',  'paid'),
  (9006,  5, date '2026-08-05',   94784, 'paid',  'paid'),
  (9007,  2, date '2026-08-05',   60957, 'paid',  'paid'),
  (9008,  6, date '2026-08-06',  115691, 'paid',  'paid'),
  (9009,  1, date '2026-08-07',   81863, 'paid',  'paid'),
  (9010,  7, date '2026-08-07',   48036, 'paid',  'paid'),
  (9011,  3, date '2026-08-08',  102770, 'paid',  'paid'),
  (9012,  8, date '2026-08-10',   68943, 'invoiced',  'partially_paid'),
  (9013,  2, date '2026-08-10',   35115, 'invoiced',  'partially_paid'),
  (9014,  9, date '2026-08-11',   89849, 'invoiced',  'partially_paid'),
  (9015,  4, date '2026-08-12',   56022, 'invoiced',  'viewed'),
  (9016, 10, date '2026-08-12',  110755, 'invoiced',  'viewed'),
  (9017,  1, date '2026-08-13',   76928, 'invoiced',  'sent'),
  (9018, 11, date '2026-08-14',   43101, 'invoiced',  'sent'),
  (9019,  5, date '2026-08-14',   97834, 'invoiced',  'sent'),
  (9020, 12, date '2026-08-15',   64007, 'invoiced',  'sent'),
  (9021,  1, date '2026-08-17',  118741, 'invoiced',  'sent'),
  (9022, 13, date '2026-08-01',  135172, 'paid',  'paid'),
  (9023, 14, date '2026-08-05',   80901, 'paid',  'paid'),
  (9024, 15, date '2026-08-08',  168713, 'invoiced',  'partially_paid'),
  (9025, 13, date '2026-08-12',  114442, 'invoiced',  'viewed'),
  (9026, 16, date '2026-08-17',   60172, 'invoiced',  'sent'),
  (9027, 20, date '2026-08-01',   28278, 'paid',  'paid'),
  (9028, 21, date '2026-08-03',   20745, 'paid',  'paid'),
  (9029, 22, date '2026-08-04',   32934, 'paid',  'paid'),
  (9030, 23, date '2026-08-05',   25400, 'paid',  'paid'),
  (9031, 24, date '2026-08-06',   17867, 'paid',  'paid'),
  (9032, 20, date '2026-08-07',   30056, 'paid',  'paid'),
  (9033, 21, date '2026-08-08',   22523, 'paid',  'paid'),
  (9034, 22, date '2026-08-10',   34712, 'paid',  'paid'),
  (9035, 23, date '2026-08-11',   27179, 'paid',  'paid'),
  (9036, 24, date '2026-08-12',   19646, 'paid',  'paid'),
  (9037, 20, date '2026-08-13',   31834, 'paid',  'paid'),
  (9038, 21, date '2026-08-14',   24301, 'paid',  'paid'),
  (9039, 22, date '2026-08-15',   16768, 'paid',  'paid'),
  (9040, 23, date '2026-08-17',   28957, 'paid',  'paid'),
  (9041, 25, date '2026-08-01',   57756, 'paid',  'paid'),
  (9042, 26, date '2026-08-05',   40896, 'paid',  'paid'),
  (9043, 27, date '2026-08-08',   68175, 'paid',  'paid'),
  (9044, 28, date '2026-08-12',   51316, 'invoiced',  'viewed'),
  (9045, 25, date '2026-08-17',   34457, 'paid',  'paid'),
  (9046,  8, date '2026-06-08',   88000, 'invoiced',  'overdue'),
  (9047,  8, date '2026-06-16',   78000, 'invoiced',  'overdue'),
  (9048, 12, date '2026-06-11',   56000, 'invoiced',  'overdue'),
  (9049, 12, date '2026-06-17',   49000, 'invoiced',  'overdue'),
  (9050, 14, date '2026-07-01',   42000, 'invoiced',  'overdue')
),
prod(pidx, pname, punit, sell) as (values
  ( 1::int, 'Mixed Salad Leaf (crate)',        'crate',  245.68::numeric),
  ( 2, 'Baby Spinach (crate)',                 'crate',  219.12),
  ( 3, 'Tomatoes (kg)',                        'kg',      39.01),
  ( 4, 'Onions (10kg bag)',                    'bag',    152.72),
  ( 5, 'Potatoes (10kg bag)',                  'bag',    179.28),
  ( 6, 'Carrots (10kg bag)',                   'bag',    142.76),
  ( 7, 'Butternut (kg)',                       'kg',      24.57),
  ( 8, 'Mixed Peppers (5kg box)',              'box',    278.88),
  ( 9, 'Cucumbers (box)',                      'box',    159.36),
  (10, 'Seasonal Citrus (15kg box)',           'box',    285.52),
  (11, 'Seasonal Apples (12.5kg box)',         'box',    428.28),
  (12, 'Mixed Herbs (bunch)',                  'bunch',   19.09),
  (13, 'Chicken Portions (10kg box)',          'box',    830.80),
  (14, 'Beef Mince (kg)',                      'kg',     153.40),
  (15, 'Lamb Cuts (kg)',                       'kg',     269.10),
  (16, 'Line Fish Fillet (kg)',                'kg',     228.48),
  (17, 'Sausage / Boerewors (kg)',             'kg',     138.24),
  (18, 'Rice (10kg bag)',                      'bag',    254.56),
  (19, 'Maize Meal (12.5kg bag)',              'bag',    200.60),
  (20, 'Cake Flour (12.5kg bag)',              'bag',    224.40),
  (21, 'Cooking Oil (4×5L case)',              'case',   972.80),
  (22, 'Sugar (12.5kg bag)',                   'bag',    272.16),
  (23, 'Fresh Milk (12×1L case)',              'case',   235.20),
  (24, 'Butter Blocks (case)',                 'case',   649.70),
  (25, 'Cheese Block (kg)',                    'kg',     204.24),
  (26, 'Prepared Salad Mix (2kg tub)',         'tub',    152.88),
  (27, 'Prepared Veg Mix (2.5kg tub)',         'tub',    159.08),
  (28, 'Ready Meal Trays (12/case)',           'case',   552.96),
  (29, 'Stock & Sauce Base (6×2L case)',       'case',   372.40),
  (30, 'Bread Rolls (24/bag)',                 'bag',     86.10),
  (31, 'Punnets & Trays (sleeve)',             'sleeve', 299.04),
  (32, 'Cartons — Standard (bundle)',          'bundle', 207.68)
),
-- 18 baskets (blueprint §8.4). The weights are revenue shares, and they are what
-- produce the per-segment cost/sell ratios: wholesale 0.62037 · catering 0.63254
-- · counter 0.59547 · farm-gate 0.60241 → blended 0.61800.
basket(bk, line_no, pidx, weight) as (values
  ('W0', 1::int,  5::int, 0.34::numeric), ('W0', 2,  4, 0.26), ('W0', 3,  6, 0.18), ('W0', 4,  3, 0.13), ('W0', 5,  7, 0.09),
  ('W1', 1,  1, 0.34), ('W1', 2,  2, 0.26), ('W1', 3,  9, 0.18), ('W1', 4,  8, 0.13), ('W1', 5, 12, 0.09),
  ('W2', 1, 13, 0.34), ('W2', 2, 14, 0.26), ('W2', 3, 17, 0.18), ('W2', 4, 16, 0.13), ('W2', 5, 15, 0.09),
  ('W3', 1, 18, 0.34), ('W3', 2, 19, 0.26), ('W3', 3, 20, 0.18), ('W3', 4, 21, 0.13), ('W3', 5, 22, 0.09),
  ('W4', 1, 10, 0.34), ('W4', 2, 11, 0.26), ('W4', 3,  3, 0.18), ('W4', 4,  7, 0.13), ('W4', 5, 12, 0.09),
  ('W5', 1, 23, 0.34), ('W5', 2, 25, 0.26), ('W5', 3, 24, 0.18), ('W5', 4, 26, 0.13), ('W5', 5, 30, 0.09),
  ('W6', 1, 31, 0.34), ('W6', 2, 32, 0.26), ('W6', 3, 29, 0.18), ('W6', 4, 26, 0.13), ('W6', 5, 27, 0.09),
  ('C0', 1, 28, 0.30), ('C0', 2, 27, 0.24), ('C0', 3, 26, 0.20), ('C0', 4, 29, 0.15), ('C0', 5, 30, 0.11),
  ('C1', 1, 13, 0.30), ('C1', 2, 15, 0.24), ('C1', 3, 16, 0.20), ('C1', 4, 14, 0.15), ('C1', 5, 17, 0.11),
  ('C2', 1,  1, 0.30), ('C2', 2,  8, 0.24), ('C2', 3,  9, 0.20), ('C2', 4,  3, 0.15), ('C2', 5, 12, 0.11),
  ('C3', 1, 25, 0.30), ('C3', 2, 24, 0.24), ('C3', 3, 23, 0.20), ('C3', 4, 21, 0.15), ('C3', 5, 22, 0.11),
  ('K0', 1, 26, 0.42), ('K0', 2, 30, 0.31), ('K0', 3, 28, 0.27),
  ('K1', 1, 11, 0.42), ('K1', 2, 10, 0.31), ('K1', 3,  3, 0.27),
  ('K2', 1, 23, 0.42), ('K2', 2, 25, 0.31), ('K2', 3, 24, 0.27),
  ('K3', 1,  1, 0.42), ('K3', 2, 12, 0.31), ('K3', 3, 27, 0.27),
  ('F0', 1,  5, 0.46), ('F0', 2,  4, 0.33), ('F0', 3,  6, 0.21),
  ('F1', 1, 10, 0.46), ('F1', 2, 11, 0.33), ('F1', 3,  7, 0.21),
  ('F2', 1,  2, 0.46), ('F2', 2,  1, 0.33), ('F2', 3, 12, 0.21)
),
ordbase as (
  select o.id as order_id, o.created_at, s.idx, s.amount, s.cust_idx
  from src s
  join of_orders o on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(s.idx::text, 12, '0'))::uuid
  where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
),
keyed as (
  select b.*,
         case
           when b.cust_idx <= 12 then 'W' || (b.idx % 7)::text
           when b.cust_idx <= 19 then 'C' || (b.idx % 4)::text
           when b.cust_idx <= 24 then 'K' || (b.idx % 4)::text
           else                       'F' || (b.idx % 3)::text
         end as bk
  from ordbase b
),
lines as (
  select k.order_id, k.created_at, k.idx, k.amount,
         bs.line_no, bs.weight, p.pidx, p.pname, p.punit, p.sell,
         max(bs.line_no) over (partition by k.idx) as last_line
  from keyed k
  join basket bs on bs.bk = k.bk
  join prod   p  on p.pidx = bs.pidx
),
driver as (
  select l.*, round(l.amount * l.weight / l.sell, 1) as qdrv from lines l
),
balanced as (
  select d.*,
         case when d.line_no = d.last_line
              then round((d.amount - coalesce(
                     sum(d.qdrv * d.sell) filter (where d.line_no < d.last_line)
                       over (partition by d.idx), 0)) / d.sell, 2)
              else d.qdrv
         end as qty
  from driver d
)
select
  ('0b000000-7e5d-4c1a-9b3f-' || lpad((b.idx * 10 + b.line_no)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  b.order_id,
  ('02000000-7e5d-4c1a-9b3f-' || lpad(b.pidx::text, 12, '0'))::uuid,
  b.pname, b.qty, b.punit, b.sell, b.created_at
from balanced b;


-- ---------------------------------------------------------------------------
-- 2.3  RECONCILIATION — force EVERY new order's lines to sum exactly to its
--      planned amount. The balancing line above rounds qty to 2 dp, which can
--      leave a few rand on the table per order; over 50 orders that is enough to
--      make "August MTD R2 800 000" a lie by a couple of hundred rand. Rewrites
--      exactly one line per order (its highest line_no, picked BY ID so no uuid
--      is ever cast to a number) and is idempotent — on a re-run the drift is
--      already zero and the same qty is written back.
-- ---------------------------------------------------------------------------
with src(idx, amount) as (
  select v.idx, v.amount from (values
  (9001::int,  1::int, date '2026-08-01',   86799::numeric, 'paid',  'paid'),
  (9002,  2, date '2026-08-01',   52971, 'paid',  'paid'),
  (9003,  3, date '2026-08-03',  107705, 'paid',  'paid'),
  (9004,  1, date '2026-08-03',   73878, 'paid',  'paid'),
  (9005,  4, date '2026-08-04',   40051, 'paid',  'paid'),
  (9006,  5, date '2026-08-05',   94784, 'paid',  'paid'),
  (9007,  2, date '2026-08-05',   60957, 'paid',  'paid'),
  (9008,  6, date '2026-08-06',  115691, 'paid',  'paid'),
  (9009,  1, date '2026-08-07',   81863, 'paid',  'paid'),
  (9010,  7, date '2026-08-07',   48036, 'paid',  'paid'),
  (9011,  3, date '2026-08-08',  102770, 'paid',  'paid'),
  (9012,  8, date '2026-08-10',   68943, 'invoiced',  'partially_paid'),
  (9013,  2, date '2026-08-10',   35115, 'invoiced',  'partially_paid'),
  (9014,  9, date '2026-08-11',   89849, 'invoiced',  'partially_paid'),
  (9015,  4, date '2026-08-12',   56022, 'invoiced',  'viewed'),
  (9016, 10, date '2026-08-12',  110755, 'invoiced',  'viewed'),
  (9017,  1, date '2026-08-13',   76928, 'invoiced',  'sent'),
  (9018, 11, date '2026-08-14',   43101, 'invoiced',  'sent'),
  (9019,  5, date '2026-08-14',   97834, 'invoiced',  'sent'),
  (9020, 12, date '2026-08-15',   64007, 'invoiced',  'sent'),
  (9021,  1, date '2026-08-17',  118741, 'invoiced',  'sent'),
  (9022, 13, date '2026-08-01',  135172, 'paid',  'paid'),
  (9023, 14, date '2026-08-05',   80901, 'paid',  'paid'),
  (9024, 15, date '2026-08-08',  168713, 'invoiced',  'partially_paid'),
  (9025, 13, date '2026-08-12',  114442, 'invoiced',  'viewed'),
  (9026, 16, date '2026-08-17',   60172, 'invoiced',  'sent'),
  (9027, 20, date '2026-08-01',   28278, 'paid',  'paid'),
  (9028, 21, date '2026-08-03',   20745, 'paid',  'paid'),
  (9029, 22, date '2026-08-04',   32934, 'paid',  'paid'),
  (9030, 23, date '2026-08-05',   25400, 'paid',  'paid'),
  (9031, 24, date '2026-08-06',   17867, 'paid',  'paid'),
  (9032, 20, date '2026-08-07',   30056, 'paid',  'paid'),
  (9033, 21, date '2026-08-08',   22523, 'paid',  'paid'),
  (9034, 22, date '2026-08-10',   34712, 'paid',  'paid'),
  (9035, 23, date '2026-08-11',   27179, 'paid',  'paid'),
  (9036, 24, date '2026-08-12',   19646, 'paid',  'paid'),
  (9037, 20, date '2026-08-13',   31834, 'paid',  'paid'),
  (9038, 21, date '2026-08-14',   24301, 'paid',  'paid'),
  (9039, 22, date '2026-08-15',   16768, 'paid',  'paid'),
  (9040, 23, date '2026-08-17',   28957, 'paid',  'paid'),
  (9041, 25, date '2026-08-01',   57756, 'paid',  'paid'),
  (9042, 26, date '2026-08-05',   40896, 'paid',  'paid'),
  (9043, 27, date '2026-08-08',   68175, 'paid',  'paid'),
  (9044, 28, date '2026-08-12',   51316, 'invoiced',  'viewed'),
  (9045, 25, date '2026-08-17',   34457, 'paid',  'paid'),
  (9046,  8, date '2026-06-08',   88000, 'invoiced',  'overdue'),
  (9047,  8, date '2026-06-16',   78000, 'invoiced',  'overdue'),
  (9048, 12, date '2026-06-11',   56000, 'invoiced',  'overdue'),
  (9049, 12, date '2026-06-17',   49000, 'invoiced',  'overdue'),
  (9050, 14, date '2026-07-01',   42000, 'invoiced',  'overdue')
  ) as v(idx, cust_idx, order_date, amount, order_status, invoice_status)
),
mine as (
  select oi.id, oi.order_id, oi.qty, oi.unit_price, s.idx, s.amount
  from of_order_items oi
  join of_orders o on o.id = oi.order_id
  join src s on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(s.idx::text, 12, '0'))::uuid
  where oi.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
),
agg as (
  select m.idx, m.amount,
         sum(m.qty * m.unit_price) as actual,
         (array_agg(m.id order by m.id desc))[1] as fix_id
  from mine m group by m.idx, m.amount
),
fix as (select a.fix_id, a.amount - a.actual as delta from agg a)
update of_order_items t
   set qty = round(t.qty + fix.delta / t.unit_price, 6)
  from fix
 where t.id = fix.fix_id;


-- ---------------------------------------------------------------------------
-- 2.4  INVOICES — one per order (group 0c, same index as its order).
--      `issue_date` is the order date, `due_date` is issue + the customer's
--      terms, exactly as the seed does it, so the five late payers' due dates
--      fall out of the customer record instead of being asserted:
--        cust  8 (30-day terms) issued 08 Jun -> due 08 Jul -> 40 days late
--        cust  8 (30-day terms) issued 16 Jun -> due 16 Jul -> 32 days late
--        cust 12 (30-day terms) issued 11 Jun -> due 11 Jul -> 37 days late
--        cust 12 (30-day terms) issued 17 Jun -> due 17 Jul -> 31 days late
--        cust 14 (14-day terms) issued 01 Jul -> due 15 Jul -> 33 days late
--      Stored status 'overdue' is what OPEN_INVOICE_STATUSES (planwise-data.ts:81)
--      keys off; effectiveInvoiceStatus() then re-derives the same answer for
--      Finch's overdueInvoices() because the invoice is unpaid and past due.
--      None of the five carries a part payment — a payment of any size makes
--      effectiveInvoiceStatus() return 'partially_paid' and the invoice would
--      vanish from the overdue list.
-- ---------------------------------------------------------------------------
insert into of_invoices (
  id, org_id, customer_id, order_id, invoice_number, status, issue_date, due_date,
  vat_rate, rebate_pct, discount, customer_po, billing_address, delivery_address,
  delivery_instructions, notes, terms, sent_at, created_at, updated_at)
with src(idx, cust_idx, order_date, amount, order_status, invoice_status) as (values
  (9001::int,  1::int, date '2026-08-01',   86799::numeric, 'paid',  'paid'),
  (9002,  2, date '2026-08-01',   52971, 'paid',  'paid'),
  (9003,  3, date '2026-08-03',  107705, 'paid',  'paid'),
  (9004,  1, date '2026-08-03',   73878, 'paid',  'paid'),
  (9005,  4, date '2026-08-04',   40051, 'paid',  'paid'),
  (9006,  5, date '2026-08-05',   94784, 'paid',  'paid'),
  (9007,  2, date '2026-08-05',   60957, 'paid',  'paid'),
  (9008,  6, date '2026-08-06',  115691, 'paid',  'paid'),
  (9009,  1, date '2026-08-07',   81863, 'paid',  'paid'),
  (9010,  7, date '2026-08-07',   48036, 'paid',  'paid'),
  (9011,  3, date '2026-08-08',  102770, 'paid',  'paid'),
  (9012,  8, date '2026-08-10',   68943, 'invoiced',  'partially_paid'),
  (9013,  2, date '2026-08-10',   35115, 'invoiced',  'partially_paid'),
  (9014,  9, date '2026-08-11',   89849, 'invoiced',  'partially_paid'),
  (9015,  4, date '2026-08-12',   56022, 'invoiced',  'viewed'),
  (9016, 10, date '2026-08-12',  110755, 'invoiced',  'viewed'),
  (9017,  1, date '2026-08-13',   76928, 'invoiced',  'sent'),
  (9018, 11, date '2026-08-14',   43101, 'invoiced',  'sent'),
  (9019,  5, date '2026-08-14',   97834, 'invoiced',  'sent'),
  (9020, 12, date '2026-08-15',   64007, 'invoiced',  'sent'),
  (9021,  1, date '2026-08-17',  118741, 'invoiced',  'sent'),
  (9022, 13, date '2026-08-01',  135172, 'paid',  'paid'),
  (9023, 14, date '2026-08-05',   80901, 'paid',  'paid'),
  (9024, 15, date '2026-08-08',  168713, 'invoiced',  'partially_paid'),
  (9025, 13, date '2026-08-12',  114442, 'invoiced',  'viewed'),
  (9026, 16, date '2026-08-17',   60172, 'invoiced',  'sent'),
  (9027, 20, date '2026-08-01',   28278, 'paid',  'paid'),
  (9028, 21, date '2026-08-03',   20745, 'paid',  'paid'),
  (9029, 22, date '2026-08-04',   32934, 'paid',  'paid'),
  (9030, 23, date '2026-08-05',   25400, 'paid',  'paid'),
  (9031, 24, date '2026-08-06',   17867, 'paid',  'paid'),
  (9032, 20, date '2026-08-07',   30056, 'paid',  'paid'),
  (9033, 21, date '2026-08-08',   22523, 'paid',  'paid'),
  (9034, 22, date '2026-08-10',   34712, 'paid',  'paid'),
  (9035, 23, date '2026-08-11',   27179, 'paid',  'paid'),
  (9036, 24, date '2026-08-12',   19646, 'paid',  'paid'),
  (9037, 20, date '2026-08-13',   31834, 'paid',  'paid'),
  (9038, 21, date '2026-08-14',   24301, 'paid',  'paid'),
  (9039, 22, date '2026-08-15',   16768, 'paid',  'paid'),
  (9040, 23, date '2026-08-17',   28957, 'paid',  'paid'),
  (9041, 25, date '2026-08-01',   57756, 'paid',  'paid'),
  (9042, 26, date '2026-08-05',   40896, 'paid',  'paid'),
  (9043, 27, date '2026-08-08',   68175, 'paid',  'paid'),
  (9044, 28, date '2026-08-12',   51316, 'invoiced',  'viewed'),
  (9045, 25, date '2026-08-17',   34457, 'paid',  'paid'),
  (9046,  8, date '2026-06-08',   88000, 'invoiced',  'overdue'),
  (9047,  8, date '2026-06-16',   78000, 'invoiced',  'overdue'),
  (9048, 12, date '2026-06-11',   56000, 'invoiced',  'overdue'),
  (9049, 12, date '2026-06-17',   49000, 'invoiced',  'overdue'),
  (9050, 14, date '2026-07-01',   42000, 'invoiced',  'overdue')
)
select
  ('0c000000-7e5d-4c1a-9b3f-' || lpad(s.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  o.customer_id,
  o.id,
  'INV-' || lpad((4141 + s.idx)::text, 4, '0'),
  s.invoice_status,
  s.order_date,
  s.order_date + coalesce(c.payment_terms_days, 0),
  15,
  coalesce(c.rebate_pct, 0),
  0,
  o.customer_po,
  c.billing_address,
  o.delivery_address,
  o.delivery_instructions,
  case when coalesce(c.rebate_pct, 0) > 0
       then 'Contract rebate of ' || c.rebate_pct::text || '% applied to this invoice.' end,
  case when coalesce(c.payment_terms_days, 0) = 0 then 'Payable on collection.'
       else coalesce(c.payment_terms_days, 0)::text || ' days from invoice date.' end,
  o.created_at + interval '2 hours',
  o.created_at,
  o.created_at
from src s
join of_orders o on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(s.idx::text, 12, '0'))::uuid
join of_customers c on c.id = o.customer_id
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- Back-link the order to its invoice. getOrderDetail (orderflow-data.ts:388)
-- loads the invoice, its lines and its payments off `of_orders.invoice_id` —
-- leave it null and every one of these order pages reads as un-invoiced.
update of_orders o
   set invoice_id = i.id
  from of_invoices i
 where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and i.order_id = o.id
   and o.id::text like '0a000000-7e5d-4c1a-9b3f-000000009%';


-- ---------------------------------------------------------------------------
-- 2.5  INVOICE LINES (group 0d, same counter as the of_order_items row).
--      A straight projection: the Dashboard, Invoices, Payments and credit-note
--      views all total money from of_invoice_items, so without this the money
--      tiles and the order book disagree.
--
--      NO ARITHMETIC ON A UUID SUFFIX. demo-all-in-one.sql derives sort_order as
--      `substr(oi.id::text, 34)::int % 10`, which works there only because it
--      runs against a freshly seeded org. On a LIVE Meridian, `of_order_items`
--      also holds rows the app created with gen_random_uuid(), whose suffix is
--      hex ('...2ee677036c2a') and throws 22P02 the instant it meets ::int —
--      and a WHERE clause is no defence, because the planner is free to project
--      before it filters. row_number() over the (already 9xxx-filtered) rows
--      gives the same 1..5 line order without reading a digit out of an id.
--      The `substr` that builds the 0d id is kept: it is a TEXT concatenation
--      cast to uuid, and any 12 hex characters are a valid uuid tail, so it
--      cannot throw whatever row it meets.
-- ---------------------------------------------------------------------------
insert into of_invoice_items (id, org_id, invoice_id, stock_item_id, name, qty, unit, unit_price, sort_order, created_at)
select ('0d000000-7e5d-4c1a-9b3f-' || substr(oi.id::text, 25))::uuid,
       oi.org_id, inv.id, oi.stock_item_id, oi.name, oi.qty, oi.unit, oi.unit_price,
       row_number() over (partition by inv.id order by oi.id),
       oi.created_at
from of_order_items oi
join of_orders   o   on o.id  = oi.order_id
join of_invoices inv on inv.order_id = o.id
where oi.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and oi.id::text like '0b000000-7e5d-4c1a-9b3f-00000009%';


-- ---------------------------------------------------------------------------
-- 2.6  PAYMENTS (group 0e — settling payment = order index; a part payment on
--      a partially_paid invoice = 509000 + the last two digits of the index).
--      The amount is recomputed from the invoice's own lines with exactly the
--      arithmetic docTotals() uses (subtotal -> rebate -> net -> 15 % VAT ->
--      total), so effectiveInvoiceStatus() agrees with the stored status instead
--      of quietly downgrading a 'paid' invoice over a rounding cent.
--      paid_on is 1-8 days after issue and never later than today (2026-08-17).
-- ---------------------------------------------------------------------------
insert into of_payments (id, org_id, invoice_id, customer_id, amount, method, paid_on, reference, notes, created_at)
-- `idx` and `cust_idx` come from the SAME literal list §2.1 built the orders
-- from — never from `substr(id::text, 25)::int`. That cast is what
-- demo-all-in-one.sql does, and on a live Meridian it throws
-- `22P02 invalid input syntax for type integer: "2ee677036c2a"` the moment the
-- scan reaches an of_invoices / of_customers row the APP created with
-- gen_random_uuid(). Re-declaring the list costs 50 lines and removes the whole
-- class of failure: nothing below ever reads a number out of a uuid.
with src(idx, cust_idx, order_date, amount, order_status, invoice_status) as (values
  (9001::int,  1::int, date '2026-08-01',   86799::numeric, 'paid',  'paid'),
  (9002,  2, date '2026-08-01',   52971, 'paid',  'paid'),
  (9003,  3, date '2026-08-03',  107705, 'paid',  'paid'),
  (9004,  1, date '2026-08-03',   73878, 'paid',  'paid'),
  (9005,  4, date '2026-08-04',   40051, 'paid',  'paid'),
  (9006,  5, date '2026-08-05',   94784, 'paid',  'paid'),
  (9007,  2, date '2026-08-05',   60957, 'paid',  'paid'),
  (9008,  6, date '2026-08-06',  115691, 'paid',  'paid'),
  (9009,  1, date '2026-08-07',   81863, 'paid',  'paid'),
  (9010,  7, date '2026-08-07',   48036, 'paid',  'paid'),
  (9011,  3, date '2026-08-08',  102770, 'paid',  'paid'),
  (9012,  8, date '2026-08-10',   68943, 'invoiced',  'partially_paid'),
  (9013,  2, date '2026-08-10',   35115, 'invoiced',  'partially_paid'),
  (9014,  9, date '2026-08-11',   89849, 'invoiced',  'partially_paid'),
  (9015,  4, date '2026-08-12',   56022, 'invoiced',  'viewed'),
  (9016, 10, date '2026-08-12',  110755, 'invoiced',  'viewed'),
  (9017,  1, date '2026-08-13',   76928, 'invoiced',  'sent'),
  (9018, 11, date '2026-08-14',   43101, 'invoiced',  'sent'),
  (9019,  5, date '2026-08-14',   97834, 'invoiced',  'sent'),
  (9020, 12, date '2026-08-15',   64007, 'invoiced',  'sent'),
  (9021,  1, date '2026-08-17',  118741, 'invoiced',  'sent'),
  (9022, 13, date '2026-08-01',  135172, 'paid',  'paid'),
  (9023, 14, date '2026-08-05',   80901, 'paid',  'paid'),
  (9024, 15, date '2026-08-08',  168713, 'invoiced',  'partially_paid'),
  (9025, 13, date '2026-08-12',  114442, 'invoiced',  'viewed'),
  (9026, 16, date '2026-08-17',   60172, 'invoiced',  'sent'),
  (9027, 20, date '2026-08-01',   28278, 'paid',  'paid'),
  (9028, 21, date '2026-08-03',   20745, 'paid',  'paid'),
  (9029, 22, date '2026-08-04',   32934, 'paid',  'paid'),
  (9030, 23, date '2026-08-05',   25400, 'paid',  'paid'),
  (9031, 24, date '2026-08-06',   17867, 'paid',  'paid'),
  (9032, 20, date '2026-08-07',   30056, 'paid',  'paid'),
  (9033, 21, date '2026-08-08',   22523, 'paid',  'paid'),
  (9034, 22, date '2026-08-10',   34712, 'paid',  'paid'),
  (9035, 23, date '2026-08-11',   27179, 'paid',  'paid'),
  (9036, 24, date '2026-08-12',   19646, 'paid',  'paid'),
  (9037, 20, date '2026-08-13',   31834, 'paid',  'paid'),
  (9038, 21, date '2026-08-14',   24301, 'paid',  'paid'),
  (9039, 22, date '2026-08-15',   16768, 'paid',  'paid'),
  (9040, 23, date '2026-08-17',   28957, 'paid',  'paid'),
  (9041, 25, date '2026-08-01',   57756, 'paid',  'paid'),
  (9042, 26, date '2026-08-05',   40896, 'paid',  'paid'),
  (9043, 27, date '2026-08-08',   68175, 'paid',  'paid'),
  (9044, 28, date '2026-08-12',   51316, 'invoiced',  'viewed'),
  (9045, 25, date '2026-08-17',   34457, 'paid',  'paid'),
  (9046,  8, date '2026-06-08',   88000, 'invoiced',  'overdue'),
  (9047,  8, date '2026-06-16',   78000, 'invoiced',  'overdue'),
  (9048, 12, date '2026-06-11',   56000, 'invoiced',  'overdue'),
  (9049, 12, date '2026-06-17',   49000, 'invoiced',  'overdue'),
  (9050, 14, date '2026-07-01',   42000, 'invoiced',  'overdue')
),
sums as (
  select ii.invoice_id, round(sum(ii.qty * ii.unit_price), 2) as sub
  from of_invoice_items ii
  where ii.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
    and ii.id::text like '0d000000-7e5d-4c1a-9b3f-00000009%'
  group by ii.invoice_id
),
tot as (
  select i.id, i.customer_id, i.status, i.issue_date,
         v.idx, v.cust_idx,
         round(s.sub - round(s.sub * coalesce(i.rebate_pct, 0) / 100, 2), 2) as net
  from src v
  join of_invoices i
    on i.id = ('0c000000-7e5d-4c1a-9b3f-' || lpad(v.idx::text, 12, '0'))::uuid
   and i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  join sums s on s.invoice_id = i.id
),
inv as (
  select t.*, round(t.net + round(t.net * 0.15, 2), 2) as total,
         least(t.issue_date + (1 + (t.idx % 8)), date '2026-08-17') as paid_on
  from tot t
)
select
  ('0e000000-7e5d-4c1a-9b3f-' || lpad(inv.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  inv.id, inv.customer_id,
  inv.total,
  case when inv.cust_idx between 20 and 25
       then (array['cash','card','card'])[(inv.idx % 3) + 1] else 'eft' end,
  inv.paid_on,
  'PMT-' || lpad(inv.idx::text, 5, '0'),
  null::text,
  (inv.paid_on + time '11:20')::timestamp at time zone 'Africa/Johannesburg'
from inv
where inv.status = 'paid'
union all
select
  ('0e000000-7e5d-4c1a-9b3f-' || lpad((500000 + inv.idx)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  inv.id, inv.customer_id,
  round(inv.total * (array[0.35,0.40,0.45,0.50,0.55,0.60])[(inv.idx % 6) + 1], 2),
  'eft',
  inv.paid_on,
  'PMT-' || lpad(inv.idx::text, 5, '0') || '-A',
  'Part payment received — balance promised with the next run.',
  (inv.paid_on + time '11:20')::timestamp at time zone 'Africa/Johannesburg'
from inv
where inv.status = 'partially_paid';


-- ##########################################################################
-- ##  SECTION 3 — PROCUREPULSE: movements to today, shrinkage, one line low
-- ##########################################################################
--
-- READ THIS BEFORE CHANGING ANYTHING HERE. `pp_stock_items.on_hand` is a
-- STORED level, not a rollup: fetchStock() (procurepulse-queries.ts:40) does a
-- bare `select *` and nothing in the codebase ever sums pp_movements.change.
-- So the ledger below is the audit trail a human reads on the item page, and
-- §3.2 is what every KPI, alert and anomaly actually keys off. They have to be
-- written as a pair or the story ("the count found 14 boxes missing") is on
-- screen in one place and contradicted in the other.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3.1  MOVEMENTS (group 19, ids 9001-9192) — 6 slots x 32 lines, 31 Jul -> 17 Aug.
--      Same generator shape as demo-all-in-one.sql §13: magnitudes scale off
--      `base = greatest(round(low_threshold * 0.9), 2)` so a 20-unit line never
--      receives 600 boxes, and the reason vocabulary is MovementReason
--      (lib/platform/types.ts:279) — `change` is SIGNED, negative for
--      consumption, and the reason travels with the sign.
--      Receipts per line in August = round(2.0b) + round(1.4b) + round(1.8b).
-- ---------------------------------------------------------------------------
insert into pp_movements (id, org_id, stock_item_id, change, reason, source_label, occurred_at)
select ('19000000-7e5d-4c1a-9b3f-' || lpad((9000 + (i.idx - 1) * 6 + g.slot + 1)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       i.id,
       case g.slot
         when 0 then  round(i.base * 2.0)
         when 1 then -round(i.base * 0.60)
         when 2 then -round(i.base * 0.75)
         when 3 then  round(i.base * 1.40)
         when 4 then  round(i.base * 1.80)
         else        -round(i.base * 0.70)
       end,
       case g.slot
         when 0 then 'order_received'
         when 1 then 'recipe_consumed'
         when 2 then 'transfer'
         when 3 then 'document_sync'
         when 4 then 'order_received'
         else        'recipe_consumed'
       end,
       case g.slot
         when 0 then i.cheapest_supplier
         when 4 then i.cheapest_supplier
         when 3 then 'Doc-U feed — supplier invoice'
         when 2 then case i.idx % 4 when 0 then 'Dispatch — trade route'
                                    when 1 then 'Dispatch — events kitchen'
                                    when 2 then 'Dispatch — counter sites'
                                    else 'Dispatch — farm gate' end
         else 'Prep batch — ' || coalesce(i.category, 'Production')
       end,
       timestamptz '2026-08-17 17:30+02'
         - ((g.slot * 3 + (i.idx % 3)) * 24 + (i.idx % 7)) * interval '1 hour'
from (
  -- THE 32 SEED LINES ONLY, ADDRESSED BY THEIR BLUEPRINT UUIDs.
  --
  -- This is deliberately NOT `from pp_stock_items where org_id = <meridian>`.
  -- A live Meridian is not a freshly seeded one: every stock line a human has
  -- added through ProcurePulse since July carries a gen_random_uuid() id, and
  -- the obvious way to recover this file's counter `n` from such a row —
  -- `substr(s.id::text, 25)::int` — throws
  --   ERROR 22P02: invalid input syntax for type integer: "2ee677036c2a"
  -- on the first one it meets. That is not fixable with a WHERE clause: the
  -- planner may evaluate the target list before the filter, so the cast has to
  -- go, not be guarded.
  --
  -- Driving the join from generate_series inverts the dependency: `n` is known
  -- BEFORE any row is read, the id is BUILT from it rather than parsed out of
  -- it, and a stock line this file does not know about simply never joins.
  select s.id, s.category, s.cheapest_supplier,
         k.n as idx,
         greatest(round(s.low_threshold * 0.9), 2) as base
  from generate_series(1, 32) as k(n)
  join pp_stock_items s
    on s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(k.n::text, 12, '0'))::uuid
   and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
) i
cross join generate_series(0, 5) as g(slot);


-- ---------------------------------------------------------------------------
--      The two count adjustments (ids 9301, 9302), Sat 15 Aug — the monthly
--      count. Sized as a percentage of what the line ACTUALLY received in
--      August (the three positive slots above):
--        item 13 Chicken Portions: 114 boxes in, -12 % = -14 boxes (R8 680)
--        item 25 Cheese Block:     130 kg    in,  -8 % = -10 kg    (R1 380)
--      Written as literals rather than derived, because the percentage is the
--      story and a derived value would silently change if §3.1's slots ever do.
-- ---------------------------------------------------------------------------
insert into pp_movements (id, org_id, stock_item_id, change, reason, source_label, occurred_at)
select ('19000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.item::text, 12, '0'))::uuid,
       v.change, 'count_adjustment', v.source_label, v.occurred_at::timestamptz
from (values
  (9301, 13, -14, 'Stock count — Cold Store',  '2026-08-15T16:40:00+02'),
  (9302, 25, -10, 'Stock count — Cold Store',  '2026-08-15T16:52:00+02')
) as v(n, item, change, source_label, occurred_at);


-- ---------------------------------------------------------------------------
-- 3.2  STOCK LEVELS. An UPDATE of three SEED rows, scoped to the three exact
--      Meridian stock-item UUIDs and to the Meridian org. Nothing else in
--      pp_stock_items is touched — in particular avg_unit_price and
--      price_history are left alone, because the seed pins "last price_history
--      point == avg_unit_price" for PricePilot's detectCostSpikes() and the
--      exact count of STEP/CREEP spikes there is load-bearing.
--
--      `stock_history` moves with `on_hand` (the seed's own invariant: the last
--      point of the 7-point sparkline IS the current level), so the item page's
--      trend line shows the draw-down rather than a flat line that ends
--      somewhere the number underneath it disagrees with.
--
--        13 Chicken Portions  86 -> 72   the -14 count adjustment above
--        25 Cheese Block      96 -> 86   the -10 count adjustment above
--        21 Cooking Oil       58 -> 12   BELOW pp_stock_thresholds.low_threshold
--                                        (16) -> stockStatus() = 'low', so it
--                                        joins the alert list in ProcurePulse
--                                        AND in InsightGen's low-stock anomaly.
--                                        Same supplier as the +10.1 % price
--                                        finding: the reorder and the increase
--                                        are the same conversation.
-- ---------------------------------------------------------------------------
update pp_stock_items s
   set on_hand       = v.on_hand,
       stock_history = v.stock_history::jsonb
  from (values
    (13, 72, '[70,76,78,83,86,80,72]'),
    (21, 12, '[49,52,55,58,42,27,12]'),
    (25, 86, '[80,86,89,93,96,92,86]')
  ) as v(n, on_hand, stock_history)
 where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid;


-- ##########################################################################
-- ##  SECTION 4 — SHIFTBOARD: move the roster week forward
-- ##########################################################################
--
-- WHY THIS IS AN UPDATE AND NOT NEW ROWS. `sb_roster_shifts` holds ONE row per
-- employee for ONE week — `label` and `open_shifts` are week-level facts stored
-- redundantly on every row — and getShiftBoardData() (shiftboard-data.ts:134)
-- reads EVERY row for the org into a single grid. Inserting a second week's 45
-- rows would render each of the 45 people twice, which reads as a bug, not as a
-- new week. `sb_attendance` is the same shape with no date column at all
-- (shiftboard-data.ts:135) — it is "today", so it can never be stale and must
-- not be duplicated either. The only thing actually stale on ShiftBoard is the
-- week LABEL, so that is the only thing changed. Scoped to the Meridian org and
-- to the two blueprint groups (2a = roster, 2d = shift swaps).
--
-- The roster's day cells carry weekday names and times, never dates, so moving
-- the label is truthful; sb_leave_requests already runs into September.
-- ##########################################################################

update sb_roster_shifts
   set label = 'Week of 17 Aug'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text like '2a000000-7e5d-4c1a-9b3f-%';

update sb_shift_swaps
   set week_label = 'Week of 17 Aug',
       -- the three seeded swaps were proposed the evening before the week they
       -- belong to; keep that relationship rather than leaving July timestamps
       -- under an August heading.
       proposed_at = proposed_at + interval '20 days'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and week_label = 'Week of 27 Jul'
   and id::text like '2d000000-7e5d-4c1a-9b3f-%';


-- ##########################################################################
-- ##  SECTION 5 — WASTEWATCH: August waste events
-- ##########################################################################
--
-- 38 events, 01-17 Aug, R33 919 total = 1.96 % of August COGS (R2 800 000
-- revenue x the blueprint's 61.8 % cost ratio = R1 730 400) — the same ~2 %
-- run-rate the seed holds for April-July, so PlanWise's month-to-date waste
-- line and InsightGen's waste-trend anomaly both read "normal", not "spike".
--
-- `category` and `device` are DENORMALISED TEXT, not foreign keys: they are
-- joined by name to ww_waste_categories (group 2e) and ww_devices (group 2f).
-- Every string below is byte-identical to those rows — note "Packaging & Other"
-- (the waste category) is NOT "Packaging" (the ProcurePulse category), and
-- every device name uses a spaced em dash. `item`/`ingredient` likewise match
-- pp_stock_items.name exactly, multiplication signs and all.
-- `cost` = qty x the item's avg_unit_price, rounded to the rand.
-- ##########################################################################

insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000009001','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-01','07:12','Mixed Salad Leaf (crate)','Field Produce',4.85,'crate',718,'Wilted',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Mixed Salad Leaf (crate)','Klipheuwel Farms','KF-1811',null),
  ('30000000-7e5d-4c1a-9b3f-000000009002','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-01','13:40','Butternut (kg)','Field Produce',22.4,'kg',332,'Trim','Soup — Butternut','Anele Mtshali','Bench Scale — Production 2','Production',false,'Normal peel and trim loss','Butternut (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009003','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-03','06:48','Bread Rolls (24/bag)','Prepared Lines',28.6,'bag',1201,'Day-old',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Yesterday’s bake, moved to staff meal','Bread Rolls (24/bag)','Swartland Grain & Mill',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009004','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-03','11:22','Chicken Portions (10kg box)','Proteins',1.86,'box',1153,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Dropped during transfer','Chicken Portions (10kg box)','Winelands Protein Co.','WP-5108',null),
  ('30000000-7e5d-4c1a-9b3f-000000009005','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-04','09:05','Tomatoes (kg)','Field Produce',36.2,'kg',851,'Spoiled',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',false,'Soft and off-smell on inspection','Tomatoes (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009006','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-04','15:31','Prepared Veg Mix (2.5kg tub)','Prepared Lines',10.75,'tub',882,'Prep error','Prepared Veg Mix','Dineo Molefe','Bench Scale — Production 1','Production',true,'Cut to the wrong spec, could not be re-used','Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009007','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-05','07:34','Cheese Block (kg)','Dairy & Chilled',9.42,'kg',1300,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,'Split packaging on the inbound load','Cheese Block (kg)','Overberg Dairy Supply','OD-6120',null),
  ('30000000-7e5d-4c1a-9b3f-000000009008','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-05','12:18','Carrots (10kg bag)','Field Produce',9.8,'bag',843,'Wilted','Soup — Seasonal Vegetable','Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Left out of cold chain during the pack run','Carrots (10kg bag)','Bergriver Growers','BG-4118',null),
  ('30000000-7e5d-4c1a-9b3f-000000009009','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-06','08:26','Line Fish Fillet (kg)','Proteins',6.35,'kg',1067,'Expired',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,'Past its use-by on the pull sheet','Line Fish Fillet (kg)','Winelands Protein Co.','WP-5216',null),
  ('30000000-7e5d-4c1a-9b3f-000000009010','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-06','16:02','Ready Meal Trays (12/case)','Prepared Lines',3.44,'case',991,'Damaged',null,'Eben Louw','Bench Scale — Production 1','Production',true,'Dropped during transfer','Ready Meal Trays (12/case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009011','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-07','07:58','Baby Spinach (crate)','Field Produce',4.26,'crate',562,'Prep error','Prepared Salad Mix','Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Wrong pack size run, reworked','Baby Spinach (crate)','Bergriver Growers','BG-4207',null),
  ('30000000-7e5d-4c1a-9b3f-000000009012','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-07','14:44','Sausage / Boerewors (kg)','Proteins',9.65,'kg',926,'Prep error','Marinated Protein Portions','Eben Louw','Bench Scale — Production 1','Production',true,'Batch over-seasoned and pulled','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009013','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-08','06:52','Potatoes (10kg bag)','Field Produce',7.15,'bag',772,'Trim','Potato Salad','Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Stalk and outer-leaf trim','Potatoes (10kg bag)','Klipheuwel Farms','KF-2044',null),
  ('30000000-7e5d-4c1a-9b3f-000000009014','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-08','10:16','Prepared Salad Mix (2kg tub)','Prepared Lines',14.3,'tub',1115,'Over-portioned','Prepared Salad Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,null,'Prepared Salad Mix (2kg tub)','Cape Cold Chain Supply',null,12),
  ('30000000-7e5d-4c1a-9b3f-000000009015','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-10','07:20','Mixed Peppers (5kg box)','Field Produce',4.62,'box',776,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,'Crushed under a badly stacked pallet','Mixed Peppers (5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009016','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-10','13:48','Butter Blocks (case)','Dairy & Chilled',2.18,'case',970,'Day-old',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Not used on the day, no second-day outlet','Butter Blocks (case)','Overberg Dairy Supply','OD-6244',null),
  ('30000000-7e5d-4c1a-9b3f-000000009017','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-11','08:40','Seasonal Citrus (15kg box)','Field Produce',3.05,'box',525,'Spoiled',null,'Chris Adams','Bench Scale — Production 2','Production',false,'Soft and off-smell on inspection','Seasonal Citrus (15kg box)','Bergriver Growers','BG-4392',null),
  ('30000000-7e5d-4c1a-9b3f-000000009018','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-11','17:06','Beef Mince (kg)','Proteins',8.9,'kg',1050,'Day-old',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Not sold on the day, no second-day outlet','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009019','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-12','09:12','Cartons — Standard (bundle)','Packaging & Other',4.05,'bundle',478,'Other',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009020','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-12','15:25','Fresh Milk (12×1L case)','Dairy & Chilled',2.66,'case',447,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Not sold on the day, no second-day outlet','Fresh Milk (12×1L case)','Overberg Dairy Supply','OD-6318',null),
  ('30000000-7e5d-4c1a-9b3f-000000009021','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-13','07:05','Lamb Cuts (kg)','Proteins',5.12,'kg',998,'Prep error','Marinated Protein Portions','Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Batch over-seasoned and pulled','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009022','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-13','12:52','Sugar (12.5kg bag)','Dry Goods',3.1,'bag',521,'Damaged',null,'Anele Mtshali','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Sugar (12.5kg bag)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009023','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-14','08:18','Mixed Salad Leaf (crate)','Field Produce',3.95,'crate',585,'Over-portioned','Prepared Salad Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,null,'Mixed Salad Leaf (crate)','Klipheuwel Farms','KF-2210',3),
  ('30000000-7e5d-4c1a-9b3f-000000009024','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-14','16:34','Stock & Sauce Base (6×2L case)','Prepared Lines',6.28,'case',1231,'Day-old',null,'Chris Adams','Bench Scale — Production 1','Production',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009025','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-15','09:48','Chicken Portions (10kg box)','Proteins',2.34,'box',1451,'Expired',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Found behind newer stock at stock count','Chicken Portions (10kg box)','Winelands Protein Co.','WP-5402',null),
  ('30000000-7e5d-4c1a-9b3f-000000009026','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-17','07:26','Prepared Veg Mix (2.5kg tub)','Prepared Lines',9.55,'tub',783,'Spoiled','Prepared Veg Mix','Dineo Molefe','Bench Scale — Production 1','Production',false,null,'Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009027','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-03','16:10','Seasonal Apples (12.5kg box)','Field Produce',2.85,'box',735,'Spoiled',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Soft and off-smell on inspection','Seasonal Apples (12.5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009028','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-05','17:22','Chicken Portions (10kg box)','Proteins',2.1,'box',1302,'Day-old',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,'Not sold on the day, no second-day outlet','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009029','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-06','12:35','Cheese Block (kg)','Dairy & Chilled',7.6,'kg',1049,'Over-portioned','Event Platter Base','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,null,'Cheese Block (kg)','Overberg Dairy Supply',null,6),
  ('30000000-7e5d-4c1a-9b3f-000000009030','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-07','16:48','Cucumbers (box)','Field Produce',5.4,'box',518,'Wilted',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009031','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-08','15:04','Butter Blocks (case)','Dairy & Chilled',1.95,'case',868,'Damaged',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',true,'Split packaging on the inbound load','Butter Blocks (case)','Overberg Dairy Supply','OD-6180',null),
  ('30000000-7e5d-4c1a-9b3f-000000009032','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-10','16:40','Ready Meal Trays (12/case)','Prepared Lines',4.62,'case',1331,'Prep error','Ready Meal — Chicken & Rice','Dineo Molefe','Bench Scale — Production 2','Production',true,'Cut to the wrong spec, could not be re-used','Ready Meal Trays (12/case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009033','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-11','12:14','Lamb Cuts (kg)','Proteins',6.48,'kg',1264,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Dropped during transfer','Lamb Cuts (kg)','Winelands Protein Co.','WP-5311',null),
  ('30000000-7e5d-4c1a-9b3f-000000009034','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-12','07:44','Mixed Salad Leaf (crate)','Field Produce',5.3,'crate',784,'Wilted',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Mixed Salad Leaf (crate)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009035','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-13','16:58','Beef Mince (kg)','Proteins',7.35,'kg',867,'Prep error','Marinated Protein Portions','Eben Louw','Bench Scale — Production 1','Production',true,'Batch over-seasoned and pulled','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009036','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-14','11:30','Line Fish Fillet (kg)','Proteins',5.8,'kg',974,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Dropped during transfer','Line Fish Fillet (kg)','Winelands Protein Co.','WP-5388',null),
  ('30000000-7e5d-4c1a-9b3f-000000009037','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-15','13:16','Seasonal Citrus (15kg box)','Field Produce',3.68,'box',633,'Spoiled',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Soft and off-smell on inspection','Seasonal Citrus (15kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000009038','01000000-7e5d-4c1a-9b3f-000000000001','2026-08-17','11:05','Chicken Portions (10kg box)','Proteins',1.72,'box',1066,'Damaged',null,'Bianca de Waal','Bench Scale — Production 1','Production',true,'Dropped during transfer','Chicken Portions (10kg box)','Winelands Protein Co.',null,null);


-- ##########################################################################
-- ##  SECTION 6 — VERIFICATION (read-only; nothing below writes)
-- ##  Run these after the file and compare against the header's static tables.
-- ##########################################################################

-- 6.1  Revenue by month. Expect 2026-06 = 6 131 000, 2026-07 = 5 197 000,
--      2026-08 = 2 800 000.
select to_char(o.created_at at time zone 'Africa/Johannesburg', 'YYYY-MM') as month,
       count(distinct o.id)                as orders,
       round(sum(i.qty * i.unit_price), 2) as revenue
from of_orders o
join of_order_items i on i.order_id = o.id
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and o.status in ('invoiced', 'paid')
group by 1 order by 1;

-- 6.2  The four price series, straight out of documents.extracted_data — the
--      exact rows lib/platform/price-watch/run.ts reads. Expect 4 points each.
--
--      HARDENED FOR A LIVE ORG, twice over. This query scans every Meridian
--      invoice document, including ones a user uploaded through Doc-U, so:
--        * `line_items` is unwrapped through a jsonb_typeof guard INSIDE the
--          function argument (a WHERE clause would not help — jsonb_array_elements
--          raises "cannot extract elements from a scalar" while producing the
--          rows the WHERE would later filter);
--        * unit_price / quantity are returned as TEXT, not ::numeric. A real
--          extraction can hold "R 176.00" or "" in those fields, and a
--          verification query that throws 22P02 is worse than useless — it
--          fails the whole script after everything above it succeeded.
select d.created_at::date   as invoice_date,
       s.name               as supplier,
       li ->> 'description' as item,
       li ->> 'unit_price'  as unit_price,
       li ->> 'quantity'    as quantity
from documents d
join suppliers s on s.id = d.supplier_id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(d.extracted_data -> 'line_items') = 'array'
       then d.extracted_data -> 'line_items' else '[]'::jsonb end) as li
where d.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and d.document_type = 'invoice'
  and d.status not in ('rejected', 'archived')
  and li ->> 'description' in ('Line fish fillet', 'Cooking oil (5L)', 'Cheese block',
                               'Prepared Salad Mix (2kg tub)')
order by 3, 1;

-- 6.3  The debtors book as effectiveInvoiceStatus() sees it: unpaid, past due.
--      Expect the five rows in the header's §3 plus the seed's own stale June
--      invoices; Northern Suburbs Supply worst at 40 days.
select c.name                                   as customer,
       i.invoice_number,
       i.due_date,
       (date '2026-08-17' - i.due_date)         as days_past_due,
       round(sum(ii.qty * ii.unit_price) * 1.15, 2) as total_incl_vat
from of_invoices i
join of_customers c      on c.id = i.customer_id
join of_invoice_items ii on ii.invoice_id = i.id
left join of_payments p  on p.invoice_id = i.id
where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and i.due_date < date '2026-08-17'
  and i.status not in ('paid', 'cancelled', 'credited', 'draft')
  and p.id is null
group by 1, 2, 3, 4
having (date '2026-08-17' - i.due_date) >= 30
order by 4 desc;

-- 6.4  Stock lines at or below their threshold. Expect 5: items 2, 16, 21, 23, 30
--      (21 Cooking Oil is the one this file pushed under).
select s.name, s.on_hand, t.low_threshold, t.par_level
from pp_stock_items s
join pp_stock_thresholds t on t.stock_item_id = s.id
where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and s.on_hand <= t.low_threshold
order by s.on_hand - t.low_threshold;

-- 6.5  August movement and waste totals. Expect 194 movements (192 + 2 counts)
--      and 38 waste events worth R33 919.
select 'pp_movements (this file)' as what, count(*)::text as rows, null::numeric as rand
from pp_movements
where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and id::text like '19000000-7e5d-4c1a-9b3f-000000009%'
union all
select 'ww_waste_events (Aug)', count(*)::text, sum(cost)
from ww_waste_events
where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and event_date >= date '2026-08-01';
