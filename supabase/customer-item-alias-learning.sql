-- ---------------------------------------------------------------------------
-- LEARNED CUSTOMER PRODUCT LINKS
--
-- `cd_customer_item_aliases` already existed (customer-ai-invoicing.sql) as a
-- table a human filled in BY HAND on the customer's settings screen: one row per
-- quirky order name, typed in advance by someone who already knew the customer
-- writes "FF - NAARTJIES Box". Almost nobody does that in advance. The place the
-- knowledge actually appears is the order review screen, at the moment a
-- reviewer looks at "VEG - SWEET CORN PKT Each → not matched" and picks Sweet
-- Corn — and until now that ruling died with the document. The same customer's
-- next order asked the same question again.
--
-- These columns let a confirmation made in review be written to the same table
-- and be told apart from a hand-typed mapping afterwards:
--
--   • source      — 'review_confirm' when a reviewer confirmed it on a document,
--                   null for the rows typed on the customer settings screen.
--                   The two are honest about different things on screen:
--                   "Learned from your confirmation on 23 Aug 2026" vs
--                   "From this customer's order mappings".
--   • document_id — WHICH document the ruling was made on, so the claim above
--                   can be traced back to the paper that produced it.
--   • created_by  — WHO ruled. A learned link silently changes how every future
--                   order from this customer is priced; an unattributable
--                   mapping is not one anybody can argue with later.
--   • updated_at  — a re-confirmation OVERWRITES (the human's latest decision
--                   wins), and without this the row would still claim the first
--                   ruling's date.
--
-- SCOPE IS THE WHOLE POINT and it is already enforced by the existing
-- `unique (org_id, customer_id, raw_name)`: "strawberries → strawberry punnets"
-- learned for Indaba is a row with Indaba's customer_id and nothing else can
-- read it. Sandton Sun asks again, because Sandton Sun may well mean something
-- different by the same word.
--
-- Safe to re-run. Adds nothing to RLS: the existing org-scoped policy on the
-- table already covers these columns.
-- ---------------------------------------------------------------------------

alter table cd_customer_item_aliases
  add column if not exists source text,
  add column if not exists document_id uuid references documents(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Reading back "what has this customer taught us, most recent first" for the
-- review screen and for the customer settings list.
create index if not exists idx_cd_customer_item_aliases_source
  on cd_customer_item_aliases (org_id, customer_id, source);
