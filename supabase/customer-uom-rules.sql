-- ============================================================================
-- Customer-scoped conditional UOM rules
-- ----------------------------------------------------------------------------
-- "When this customer's paper prints KG and the description contains
-- 'punnet', bill it as punnet" — a fact about how ONE customer's paper units
-- map onto an operational unit, ruled on once in review and applied on every
-- later order automatically.
--
-- THIS IS NOT A SECOND PRODUCT-LEARNING TABLE. `cd_customer_item_aliases`
-- (customer-ai-invoicing.sql) already owns "which catalogue product does this
-- customer's wording mean" — that question, that schema, that upsert, are all
-- untouched by this file. This table answers a narrower and different
-- question: given a line whose PRODUCT is already settled, which unit does
-- this customer's printed unit actually mean. See
-- lib/platform/docu/customer-uom-rules.ts for the derivation + matching logic
-- and lib/platform/orderflow-from-doc.ts for where it sits in the precedence
-- order (an exact product alias still outranks a UOM rule — see the wiring
-- comment there).
--
-- REQUIRES orderflow-schema.sql + customer-ai-invoicing.sql to have run first
-- (references of_customers). Idempotent — safe to re-run. Paste into the
-- Supabase dashboard SQL editor. COMMITTED AS TEXT ONLY — Josh runs this by
-- hand; the code that reads this table tolerates it not existing yet (see
-- isMissingTable in orderflow-from-doc.ts / OrderReviewEditor.tsx).
-- ============================================================================

create table if not exists cd_customer_uom_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  customer_id uuid not null references of_customers(id) on delete cascade,

  -- Condition. Every value here is stored NORMALISED (lowercase, collapsed
  -- whitespace; printed_unit additionally folded through the same
  -- `normaliseUnit` spelling table the matcher already uses) — the DB never
  -- has to reproduce the fold, and two rows that only differ by case or
  -- stray spacing can't both exist to disagree with each other.
  --
  -- 'token' — description_condition is one packaging word (e.g. "punnet")
  --   the line's description must contain, word-boundary matched.
  -- 'exact_description' — description_condition is the FULL normalised
  --   description the line must equal — the fallback when no known
  --   packaging word was found, so the rule still means exactly the one line
  --   it was made from and nothing broader.
  match_kind text not null check (match_kind in ('token', 'exact_description')),
  description_condition text not null,
  -- NOT NULL by design: v1 rules always condition on the printed unit — it is
  -- the narrowest deterministic condition available. A rule that fired for
  -- "any printed unit at all" would be a much bigger claim than anything a
  -- reviewer actually confirmed on one line, so that shape is out of scope
  -- for this table entirely, not just unused.
  printed_unit text not null,

  -- Result — the operational unit this condition resolves to.
  target_unit text not null,

  active boolean not null default true,

  -- Provenance, mirroring cd_customer_item_aliases's shape so the same reader
  -- (a human checking why a line changed unit) already knows how to read it.
  source text not null default 'review_confirm',
  document_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The DB-level guarantee that "an equivalent rule already exists" is never
  -- a question the app has to answer by scanning rows: upserting on this key
  -- IS the update. Deliberately excludes target_unit — two rows that agree on
  -- everything else but disagree on the result are exactly the conflict this
  -- feature must never silently resolve (see ruleMatchesLine /
  -- applyCustomerUomRules), not two rows that can coexist.
  unique (org_id, customer_id, match_kind, description_condition, printed_unit)
);

create index if not exists idx_cd_customer_uom_rules_customer
  on cd_customer_uom_rules (org_id, customer_id) where active;

alter table cd_customer_uom_rules enable row level security;
drop policy if exists cd_customer_uom_rules_all on cd_customer_uom_rules;
create policy cd_customer_uom_rules_all on cd_customer_uom_rules for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
