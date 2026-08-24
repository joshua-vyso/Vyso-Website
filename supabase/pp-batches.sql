-- Manufacturing batches: logging a production run of a recipe. A batch records
-- what was actually used (may differ from the recipe's per-batch quantities —
-- a person weighing ingredients on the floor doesn't always hit the recipe
-- exactly) and what it produced, then moves real stock: ingredients decrement,
-- the output increments. Header (pp_batches) + ingredient lines
-- (pp_batch_ingredients), mirroring pp_recipes/pp_recipe_ingredients.
-- Org-scoped RLS. Idempotent. Paste in the Supabase SQL editor.

-- A recipe's `output_product` is free text (no FK — it predates batches and a
-- recipe author may not want to commit to a stock item up front). Batches need
-- a REAL row to increment, so link one on. Nullable + ON DELETE SET NULL: if
-- the linked product is ever removed, the recipe keeps producing (it just goes
-- back through output-resolution — fuzzy match or create — on the next batch)
-- rather than being silently broken.
alter table pp_recipes add column if not exists output_stock_item_id uuid references pp_stock_items(id) on delete set null;

create table if not exists pp_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- set null (not cascade) on recipe delete: a batch is a historical stock
  -- movement record — deleting the recipe it was made from must never erase
  -- that the stock actually moved. recipe_name is denormalised for the same
  -- reason: the audit trail should still read "Mixed Veg" after the recipe
  -- that made it is gone or renamed.
  recipe_id uuid references pp_recipes(id) on delete set null,
  recipe_name text not null,
  output_stock_item_id uuid references pp_stock_items(id) on delete set null,
  output_product text not null,
  output_qty numeric not null,
  output_unit text,
  notes text,
  -- 'chat' batches come from Finch (Phase C) confirming a card the model
  -- drafted but never wrote itself; 'manual' is the Batches page. Kept even
  -- though only 'manual' exists yet, so Phase C needs no migration.
  source text not null default 'manual' check (source in ('manual', 'chat')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_pp_batches_org on pp_batches (org_id, created_at desc);

create table if not exists pp_batch_ingredients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  batch_id uuid not null references pp_batches(id) on delete cascade,
  -- Nullable on purpose: an ingredient line that couldn't be resolved to a
  -- tracked product is still worth recording on the batch (what the person
  -- said they used) even though it moves no stock. See route.ts.
  stock_item_id uuid references pp_stock_items(id) on delete set null,
  product_name text not null,
  qty_used numeric not null,
  unit text
);
create index if not exists idx_pp_batch_ingredients_batch on pp_batch_ingredients (batch_id);

alter table pp_batches enable row level security;
alter table pp_batch_ingredients enable row level security;

drop policy if exists pp_batches_all on pp_batches;
create policy pp_batches_all on pp_batches for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists pp_batch_ingredients_all on pp_batch_ingredients;
create policy pp_batch_ingredients_all on pp_batch_ingredients for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- pp_movements.reason CHECK: verified against the base schema
-- (Vyso Platform/supabase/schema.sql) and every existing supabase/pp-*.sql
-- migration in this repo — `reason` is plain `text` with no CHECK constraint
-- anywhere, so 'recipe_consumed' and the new 'batch_produced' reason insert
-- freely today; there is nothing to ALTER. The API route still degrades to a
-- looser reason on insert failure (same shape as order-stock's adjustOnHand
-- attempts) so it keeps working unattended if a CHECK is ever added later.
