-- SupplySync credits & rebates demo seed for Fresh Valley Produce.
-- Additive sibling to 4-supplysync-seed.sql: the credit/dispute register and the
-- supplier rebate agreements + receipts. Dates are relative to `current_date`
-- so claim ages and period windows stay realistic whenever the seed is run.
-- Re-runnable: deletes this org's rows first, then re-inserts.
--
-- PREREQUISITES (in order):
--   supabase/demo-fresh-valley/4-supplysync-seed.sql  (the suppliers this joins to)
--   supabase/ss-supplier-credits.sql
--   supabase/ss-supplier-rebates.sql
-- Paste into the Supabase SQL editor and run.

delete from ss_supplier_rebate_receipts where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_rebates         where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_credits         where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Credit & dispute register — 10 claims across every state.
-- ---------------------------------------------------------------------------
insert into ss_supplier_credits (
  org_id, supplier_id, supplier_name, issue_type, reference, item, description,
  amount, amount_credited, status, claimed_on, acknowledged_on, resolved_on, owner
)
select o.id, s.id, s.name, v.issue_type, v.reference, v.item, v.description,
       v.amount, v.amount_credited,
       v.status,
       current_date - v.claimed_days_ago,
       case when v.ack_days_ago is null then null else current_date - v.ack_days_ago end,
       case when v.resolved_days_ago is null then null else current_date - v.resolved_days_ago end,
       v.owner
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Cape Town Market',    'short_ship',    'INV-CTM-40218', 'Tomatoes (jam)',      '18 crates short against the delivery note; driver signed the discrepancy.', 4860,  null, 'claimed',      3,  null, null, 'Pieter Steyn'),
  ('Two Oceans Produce',  'quality',       'INV-TOP-11907', 'Green peppers',       'Two pallets soft on arrival, rejected at goods-in and photographed.',        7240,  null, 'claimed',      9,  null, null, 'Chris Adams'),
  ('Klein Karoo Veg',     'short_ship',    'DN-KKV-3381',   'Potatoes (large)',    '1.5t short on the Thursday load; back-order never arrived.',                12500, null, 'acknowledged', 21, 14,   null, 'Aisha Patel'),
  ('Tygerberg Tomatoes',  'quality',       'INV-TYG-8842',  'Plum tomatoes',       'Grade slipped two loads running — credit agreed in principle on the call.',  5390,  null, 'acknowledged', 34, 25,   null, 'Chris Adams'),
  ('Hex River Grapes',    'not_delivered', 'PO-HRG-2209',   'Red globe grapes',    'Order confirmed then never dispatched; had to spot-buy at the market.',      9150,  null, 'claimed',      47, null, null, 'Bheki Ngcobo'),
  ('Cape Town Market',    'price_error',   'INV-CTM-39980', 'Butternut',           'Invoiced at R14.20/kg against the R11.90 agreed on the floor.',              3120,  3120, 'credited',     52, 45,   38,   'Pieter Steyn'),
  ('Two Oceans Produce',  'substitution',  'INV-TOP-11740', 'Cucumber (English)', 'Substituted for standard cucumber without approval; sold at a lower price.',  2480,  1600, 'credited',     61, 55,   44,   'Kabelo Nkosi'),
  ('Philippi Fresh Co-op','damaged',       'DN-PFC-7712',   'Baby spinach',        'Cold-chain break on the morning run; three crates unsellable.',              1890,  1890, 'credited',     40, 33,   27,   'Zinhle Khoza'),
  ('Stellenbosch Farms',  'short_ship',    'DN-SF-5540',    'Carrots (washed)',    'Half a pallet short; supplier disputes the count and we have no photo.',      2150,  0,    'written_off',  74, 66,   52,   'Aisha Patel'),
  ('Sandveld Potatoes',   'quality',       'INV-SVP-6621',  'Potatoes (medium)',   'Greening on two bags — supplier replaced stock instead of crediting.',        980,   980,  'credited',     29, 24,   19,   'Wandile Zwane')
) as v(supplier_name, issue_type, reference, item, description, amount, amount_credited, status, claimed_days_ago, ack_days_ago, resolved_days_ago, owner)
join ss_suppliers s
  on s.name = v.supplier_name
 and s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ---------------------------------------------------------------------------
-- Rebate agreements — volume/growth deals with the four biggest suppliers.
-- ---------------------------------------------------------------------------
insert into ss_supplier_rebates (
  org_id, supplier_id, supplier_name, name, basis, rate_pct, flat_amount,
  threshold_spend, period, period_start, period_end, expected_amount, status, note
)
select o.id, s.id, s.name, v.name, v.basis, v.rate_pct, v.flat_amount,
       v.threshold_spend, v.period,
       current_date - v.start_days_ago,
       current_date + v.end_days_ahead,
       v.expected_amount, v.status, v.note
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Ceres Fruit Growers',  'Q3 apple volume rebate',      'percent', 2.5,  null,   2000000, 'quarterly', 45,  45,  55000,  'accruing', 'Paid as a credit note in the month after quarter end.'),
  ('Philippi Fresh Co-op', 'Leafy greens growth rebate',  'percent', 1.8,  null,   1200000, 'quarterly', 45,  45,  null,   'accruing', 'Expected value estimated from average spend until the co-op confirms.'),
  ('Boland Citrus',        'Winter citrus season rebate', 'flat',    null, 42000,  null,    'annual',    150, 30,  42000,  'claimed',  'Claimed on the season close; part payment received.'),
  ('Cape Town Market',     'Market floor volume rebate',  'percent', 1.2,  null,   2500000, 'quarterly', 135, -45, 32000,  'agreed',   'Last quarter closed short — chase the agent.')
) as v(supplier_name, name, basis, rate_pct, flat_amount, threshold_spend, period, start_days_ago, end_days_ahead, expected_amount, status, note)
join ss_suppliers s
  on s.name = v.supplier_name
 and s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ---------------------------------------------------------------------------
-- Receipts — money that actually arrived against those agreements.
-- ---------------------------------------------------------------------------
insert into ss_supplier_rebate_receipts (org_id, rebate_id, amount, received_on, method, reference, note)
select r.org_id, r.id, v.amount, current_date - v.days_ago, v.method, v.reference, v.note
from ss_supplier_rebates r
join (values
  ('Q3 apple volume rebate',      18000, 20, 'credit_note',      'CN-CFG-2261', 'First tranche against the quarter.'),
  ('Winter citrus season rebate', 25000, 12, 'eft',              'EFT-BC-88120', 'Part payment; balance promised end of month.'),
  ('Market floor volume rebate',   9500, 60, 'invoice_discount', 'CTM-DISC-4471', 'Applied as a discount on the March statement.')
) as v(rebate_name, amount, days_ago, method, reference, note)
  on v.rebate_name = r.name
where r.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
