-- ===========================================================================
-- Doc-U: the three CREDIT document types.
--
-- WHAT THIS DOES. Widens `documents_document_type_check` to admit
-- 'supplier_credit_note', 'customer_credit_request' and 'customer_credit_note'
-- alongside every value it already allows. Nothing else: `credit_document`,
-- `financial_effect`, `business_event`, `order_amendment` and `contact_person`
-- all live in `documents.extracted_data`, which is jsonb and needs no schema
-- change at all.
--
-- WHY IT IS NEEDED AT ALL. Until now the document layer had no credit type, so
-- the email classifier's `credit_note` verdict — confidence 96–97, the highest
-- priority in that whole ladder — arrived at a layer that could only coerce it
-- to 'invoice'. Eat Your Greens CRN0012368 is what that cost: a credit stored
-- as `invoice` at confidence 92 with a POSITIVE 335.00 line, and 'invoice' is a
-- member of every operational allow-list there is. A refund filed as a purchase.
--
-- ---------------------------------------------------------------------------
-- THE ALLOWED LIST WAS MEASURED, NOT ASSUMED.
--
-- The constraint's current definition is not knowable from this repository: no
-- tracked file has ever created or widened it, and `expense_receipt` — a live,
-- accepted value — appears in no SQL here. So it was established by a read-only
-- functional probe against production on 31 Aug 2026: for each candidate value,
-- POST one `documents` row and DELETE it immediately by the id just created.
-- Nothing was left behind (verified by a follow-up select for the probe
-- filename prefix, which returned zero rows).
--
--   ACCEPTED : invoice, statement, delivery_note, price_list, order,
--              expense_receipt
--   REJECTED : receipt, supplier_credit_note, customer_credit_request,
--              customer_credit_note, zzz_bogus_type_probe
--
-- NULL is allowed and present in live data (3 rows), so the predicate below
-- keeps `document_type is null or …` exactly as the current behaviour requires.
--
-- 'receipt' IS DELIBERATELY NOT ON THE LIST, AND IS NOT COMING BACK.
--
-- components/platform/orderflow/PaymentsView.tsx used to insert a `documents`
-- row with document_type 'receipt' when a user attached proof of payment, and
-- the live constraint REFUSED it — that insert has been failing since it
-- shipped, surfacing as the generic "Could not save the receipt." error. The
-- probe above confirms both halves: 'receipt' is rejected, and the table holds
-- ZERO rows of it, so there is nothing to migrate and no compatibility
-- behaviour to preserve.
--
-- The fix is `payment_proof`, a real `DocumentType` with its own label, tile,
-- folder and empty routing rule, which PaymentsView now writes. It is NOT
-- `expense_receipt`: that type means the business consumed something and paid
-- for it and IS the record of that expense, whereas a payment proof is evidence
-- for a payment the org RECEIVED, already recorded in `of_payments` with its
-- amount, method, date and reference. Filing an EFT confirmation as an expense
-- receipt would recognise an expense for a customer's payment.
-- ---------------------------------------------------------------------------
--
-- WHY IT IS SHAPED LIKE THIS, and not a bare drop/add. Same two reasons as the
-- `documents.status` block in demo-all-in-one.sql, which this follows:
--
--   1. The constraint's NAME is not knowable from this repo. The first DO block
--      therefore drops every CHECK on `documents` whose definition both
--      mentions `document_type` and has the shape of an enum list
--      (`document_type = ANY (ARRAY[…])` / `document_type IN (…)`). Restricting
--      to that shape leaves alone any compound rule that merely happens to
--      reference the column.
--   2. This database also holds non-demo organisations. A plain ADD CONSTRAINT
--      would fail 23514 on any pre-existing row carrying a value this file did
--      not predict — rows nobody asked us to touch. The second DO block
--      therefore builds the allowed list as the ten known values UNION whatever
--      distinct non-null `document_type` values already exist, so the ALTER can
--      never fail on existing data while still admitting every value the app
--      writes.
--
-- Both blocks swallow undefined_table / undefined_object, so this file stays
-- runnable on a database where `documents` (or the constraint) is not there
-- yet, and re-runnable afterwards.
--
-- RUN IT BEFORE DEPLOYING the code that writes these types. A deploy without it
-- does not corrupt anything — a credit-typed insert is REFUSED by the
-- constraint, exactly as the probe showed — but the document fails to file.
-- ===========================================================================

-- Step 1 — drop the stale enum-list CHECK on documents.document_type, under any
--          name.
do $$
declare
  c record;
begin
  if to_regclass('public.documents') is null then
    return;
  end if;
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.documents'::regclass
      and con.contype  = 'c'
      and pg_get_constraintdef(con.oid) ~ '\mdocument_type\M'
      and pg_get_constraintdef(con.oid) ~ '(= ANY \(ARRAY\[|\mIN \()'
  loop
    execute format('alter table public.documents drop constraint %I', c.conname);
  end loop;
exception
  when undefined_table or undefined_object then null;
end $$;

-- Step 2 — re-add it over the six LIVE-VERIFIED values plus the four new ones,
--          plus any document_type already present in the table (see note 2).
do $$
declare
  -- The six the production probe accepted, then the four this work adds: three
  -- credit types and `payment_proof`. Every one of them is a member of
  -- `DocumentType` in lib/platform/types.ts, and nothing the probe accepted has
  -- been dropped.
  v_known text[] := array['invoice','statement','delivery_note','price_list',
                          'order','expense_receipt',
                          'supplier_credit_note','customer_credit_request',
                          'customer_credit_note','payment_proof'];
  v_all   text[];
  v_list  text;
begin
  if to_regclass('public.documents') is null then
    return;
  end if;

  select v_known || coalesce(array_agg(distinct d.document_type), '{}'::text[])
    into v_all
  from documents d
  where d.document_type is not null
    and not (d.document_type = any (v_known));

  select string_agg(quote_literal(q.s), ',')
    into v_list
  from (select distinct s from unnest(v_all) as s order by 1) q;

  execute 'alter table public.documents drop constraint if exists documents_document_type_check';
  -- `document_type is null or …` because NULL is allowed today and three live
  -- rows hold it: a freshly inserted document has no type until the classifier
  -- has run, and forbidding NULL here would break the upload path itself.
  execute 'alter table public.documents add constraint documents_document_type_check '
       || 'check (document_type is null or document_type in (' || v_list || '))';
exception
  when undefined_table or undefined_object then null;
end $$;
