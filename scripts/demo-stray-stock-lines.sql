-- ---------------------------------------------------------------------------
-- Meridian: catalogue lines that are NOT part of the demo seed
--
-- WHY THIS FILE EXISTS. In the P1.2 rehearsal, "what will I run out of this
-- week?" answered with twelve lines — Garlic-Whole, Lettuce-Iceberg, Avocado,
-- Cabbage-White, Brinjals, Peppers-Red, Danya, Mint… — and NONE of the five the
-- demo is built on (Line Fish Fillet 0/20, Bread Rolls 14/30, Baby Spinach
-- 6/12, Fresh Milk 18/24, Cooking Oil 12/16). Every one of those twelve sits at
-- 0 on hand with no low threshold, so days-of-cover reads 0 and they sorted
-- above everything real; the twelve-line cap then pushed the real answer off
-- the end entirely.
--
-- Finch no longer lists them (lib/ai/finch/procurepulse-data.ts: a line with no
-- threshold, nothing on hand and no receipt in 90 days is reported as a COUNT,
-- not as a line about to run out). This file is the other half — finding out
-- what those rows actually are, and, only if Josh decides so after reading part
-- (A), removing them.
--
-- RUN PART (A) ONLY. Part (B) is commented out and stays that way until part
-- (A) has been read line by line. Nothing here is run by CI, by a script, or by
-- an agent; no agent has run any of it against any database.
--
-- Meridian org: 01000000-7e5d-4c1a-9b3f-000000000001
-- Seed catalogue: the 32 deterministic ids listed literally below.
-- supabase/demo-all-in-one.sql §2 builds them as
--   ('02000000-7e5d-4c1a-9b3f-' || lpad(n, 12, '0'))::uuid   for n in 1..32
-- and they are written out in full here rather than matched on the prefix: a
-- LIKE would also spare a 33rd row someone created in the same shape, which is
-- precisely the kind of row this file is looking for.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- (A) WHAT IS THERE. Read-only — run this, read it, decide.
-- ===========================================================================
with seed_ids(id) as (
  values
    ('02000000-7e5d-4c1a-9b3f-000000000001'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000002'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000003'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000004'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000005'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000006'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000007'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000008'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000009'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000010'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000011'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000012'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000013'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000014'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000015'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000016'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000017'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000018'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000019'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000020'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000021'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000022'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000023'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000024'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000025'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000026'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000027'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000028'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000029'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000030'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000031'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000032'::uuid)
),
stray as (
  select s.*
  from pp_stock_items s
  where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
    and s.id not in (select id from seed_ids)
)
select
  stray.id,
  stray.name,
  stray.unit,
  stray.on_hand,
  stray.low_threshold                                      as item_threshold,
  t.low_threshold                                          as threshold_row,
  stray.created_at,
  (select count(*) from pp_movements m
     where m.stock_item_id = stray.id)                     as movements_total,
  (select count(*) from pp_movements m
     where m.stock_item_id = stray.id
       and m.change > 0
       and coalesce(m.reason, '') <> 'count_adjustment')   as receipts_total,
  (select count(*) from pp_movements m
     where m.stock_item_id = stray.id
       and m.change > 0
       and coalesce(m.reason, '') <> 'count_adjustment'
       and m.occurred_at >= now() - interval '90 days')    as receipts_90d,
  (select count(*) from pp_movements m
     where m.stock_item_id = stray.id
       and m.change < 0
       and m.occurred_at >= now() - interval '30 days')    as consumption_rows_30d,
  (select count(*) from pp_recipe_ingredients ri
     where ri.stock_item_id = stray.id)                    as recipe_refs,
  (select count(*) from pp_stock_order_items oi
     where oi.stock_item_id = stray.id)                    as stock_order_lines,
  (select count(*) from pp_item_suppliers isup
     where isup.stock_item_id = stray.id)                  as supplier_links
from stray
left join pp_stock_thresholds t
  on t.stock_item_id = stray.id
 and t.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
order by stray.name;


-- How many there are, and how many of them Finch is now leaving out. The second
-- figure is what `not_stocked_hidden` in the pp_get_stock_position result should
-- say — if the two disagree, the tool's rule and this file's have drifted.
with seed_ids(id) as (
  values
    ('02000000-7e5d-4c1a-9b3f-000000000001'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000002'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000003'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000004'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000005'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000006'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000007'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000008'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000009'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000010'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000011'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000012'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000013'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000014'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000015'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000016'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000017'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000018'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000019'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000020'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000021'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000022'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000023'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000024'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000025'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000026'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000027'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000028'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000029'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000030'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000031'::uuid),
    ('02000000-7e5d-4c1a-9b3f-000000000032'::uuid)
)
select
  count(*)                                                          as stray_lines,
  count(*) filter (
    where coalesce(t.low_threshold, s.low_threshold, 0) <= 0
      and coalesce(s.on_hand, 0) <= 0
      and not exists (
        select 1 from pp_movements m
        where m.stock_item_id = s.id
          and m.change > 0
          and coalesce(m.reason, '') <> 'count_adjustment'
          and m.occurred_at >= now() - interval '90 days'
      )
  )                                                                 as hidden_by_finch
from pp_stock_items s
left join pp_stock_thresholds t
  on t.stock_item_id = s.id
 and t.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
  and s.id not in (select id from seed_ids);


-- ===========================================================================
-- (B) REMOVING THEM. COMMENTED OUT — uncomment only after reading (A).
--
-- Scope: Meridian, rows outside the seed's 32, AND not referenced by a recipe
-- or a stock order. A referenced row is left alone whatever (A) said about it:
-- both foreign keys are `on delete set null`, so the reference does NOT block
-- the delete — it silently turns a recipe ingredient or an order line into an
-- orphan, which is worse than a stray catalogue row.
--
-- Children first, the item last, inside a transaction. Read the counts before
-- committing.
--
-- THIS IS DESTRUCTIVE AND IRREVERSIBLE — there is no soft delete on these
-- tables. Snapshot the Meridian org first.
-- ===========================================================================
--
-- begin;
--
-- create temporary table _stray_ids as
-- with seed_ids(id) as (
--   values
--     ('02000000-7e5d-4c1a-9b3f-000000000001'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000002'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000003'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000004'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000005'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000006'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000007'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000008'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000009'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000010'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000011'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000012'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000013'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000014'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000015'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000016'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000017'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000018'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000019'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000020'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000021'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000022'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000023'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000024'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000025'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000026'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000027'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000028'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000029'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000030'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000031'::uuid),
--     ('02000000-7e5d-4c1a-9b3f-000000000032'::uuid)
-- )
-- select s.id
-- from pp_stock_items s
-- where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
--   and s.id not in (select id from seed_ids)
--   and not exists (select 1 from pp_recipe_ingredients ri where ri.stock_item_id = s.id)
--   and not exists (select 1 from pp_stock_order_items oi where oi.stock_item_id = s.id);
--
-- -- What is about to go, one last time.
-- select s.id, s.name, s.on_hand, s.low_threshold
-- from pp_stock_items s join _stray_ids x on x.id = s.id
-- order by s.name;
--
-- delete from pp_movements
--  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
--    and stock_item_id in (select id from _stray_ids);
--
-- delete from pp_stock_thresholds
--  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
--    and stock_item_id in (select id from _stray_ids);
--
-- delete from pp_item_suppliers
--  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
--    and stock_item_id in (select id from _stray_ids);
--
-- delete from pp_stock_items
--  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'::uuid
--    and id in (select id from _stray_ids);
--
-- drop table _stray_ids;
--
-- -- rollback;   -- the safe way out
-- -- commit;     -- only when the counts above were what you expected
--
