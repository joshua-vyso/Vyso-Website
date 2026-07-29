-- Seed a few TRACKED PlanWise decisions for Fresh Valley Produce, so the demo
-- org shows the panel in its steady state (some in progress, one done) rather
-- than as a wall of fresh suggestions.
--
-- Deliberately partial: PlanWise derives the rest from measured data at read
-- time, and the panel offers those as "Suggested by PlanWise" until someone
-- tracks them. Keeping the seed thin is what makes that distinction visible.
--
-- Requires 10-planwise-decisions-schema.sql. Re-runnable: the org's rows are
-- cleared before re-inserting. HOW TO APPLY: paste into the Supabase SQL editor.
-- All money in ZAR.

delete from pw_decisions where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_decisions (org_id, decision_key, module, action, impact, impact_value, priority, status, because, sort_order)
select o.id, v.decision_key, v.module, v.action, v.impact, v.impact_value, v.priority, v.status, v.because, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('recover-outstanding', 'orderflow',    'Recover outstanding invoices',   '+R 18 000',       18000, 'high',   'in_progress', 'R 6 400 of it is already past due.',                     0),
  ('overspend-cogs-produce','procurepulse','Pull COGS (Produce) back to plan','+R 11 200 / mo', 11200, 'high',   'open',        'Tracking to R 5 772 000 against a R 5 460 000 plan.',    1),
  ('close-margin-gap',    'pricepilot',   'Reprice below-target products',  '+R 6 400 / mo',    6400, 'high',   'open',        'Realised margin is 22.0% against a 24% target.',         2),
  ('cut-waste',           'wastewatch',   'Cut logged waste',               '+R 2 400 / mo',    2400, 'medium', 'open',        'R 6 000 logged this month — 4.4% of food cost.',         3),
  ('missing-expense-docs','docu',         'Add 3 missing expense documents','Cleaner forecast',    0, 'low',    'done',        'Three supplier invoices were unreconciled last month.',  4)
) as v(decision_key, module, action, impact, impact_value, priority, status, because, sort_order)
;
