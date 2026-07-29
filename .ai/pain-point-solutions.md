# Pain → module solution map + implementation specs (29 July 2026)

Architect: Fable 5. This is the approved spec for the module flesh-out workflow. Implementers must
follow the conventions doc facts below exactly; deviations go to `.ai/implementation.md`.
Full research evidence (quotes + URLs): task output archive; summary in `Software/New_Modules.md`.

## Global rules for every module agent
- Route keys ≠ brand labels: marginview=PlanWise, wastelog=WasteWatch, suppliers=SupplySync,
  reportgen=InsightGen. Components live in `components/platform/<brand>`, lib in `lib/platform/<brand>*`.
- Follow the platform idiom EXACTLY: async server layout with `getPlatformSession` guard →
  `px-8 py-7` → `SubNav` → provider → `mt-6` children; pages are thin re-exports of client views;
  header via `ModuleHeader` + `MODULE_META`; shared kit from `components/platform/module-ui.tsx`;
  modals via portal with `fontFamily:'var(--font-instrument)'`+`--radius:0.625rem` on the wrapper.
- Design tokens (hex literals, as used repo-wide): ink #171A17, secondary #6B6F68, muted #8A8E86,
  card border #EAEDF2, primary #1F5FA8 (hover #174C87), tones: positive #E1F5EE/#0F6E56, warning
  #FBEEDA/#854F0B, critical #FCEBEB/#A32D2D, info #E6F1FB/#0C447C. Numbers get `of-num`; titles `of-display`.
- Writes go to existing tables where they exist. New tables: ADD new additive `supabase/<name>.sql`
  files following repo conventions (RLS by org_id like siblings); NEVER alter/drop existing tables.
  Demo-only schemas (pw_, sb_, ww_, ss_, ig_ in supabase/demo-fresh-valley/) may gain new additive
  sibling SQL files in the same folder.
- Each module folder is owned by exactly one agent. Shared files (module-ui.tsx, SubNav, TopBar,
  modules.ts, module-meta.ts, module-widgets) are READ-ONLY for module agents.
- Empty-state first: every new view must handle `isEmpty`/no-org data with the dashed-panel pattern.
- Verify with `npx tsc --noEmit --incremental false` (do NOT run `npm run build` — a later verifier does).
- Do not touch docu/, orderflow/, procurepulse/ feature code. Reading their tables is allowed and encouraged.

## PlanWise (app/app/marginview) — pains: COGS lag, budget vs reality, margin decay
1. Wire GoalsView's mock fields (cash/growth/outstanding, `MOCK_GOALS`) to real derivations from
   existing data (of_orders for revenue actuals, budget lines for overheads) — kill the `mock` literal.
2. Budget vs ACTUAL: month-to-date actuals per budget category derived from of_orders/of_invoices
   (pattern already proven in PricePilot page.tsx) so variance is same-day, not month-end.
3. Persist DecisionsPanel items (new additive table `pw_decisions` in demo-fresh-valley sibling sql).
4. Add `useRealtimeRefresh(['pw_budget_lines','pl_targets'])` via a small client mount in layout flow.
5. Forecast: make forecast rows editable (simple editor writing pw_forecast).

## PricePilot (app/app/pricepilot) — ADDITIVE ONLY. Pains: margin decay, price creep, variance attribution
1. "Dish crossed target" re-price alerts: extend computeNotifications to emit re-price suggestions
   (current price, target-margin price, delta) surfaced on Dashboard + Notifications.
2. Cost-spike detection: implement the TODO'd costSpikes feed (compare pp_stock_items.avg_unit_price
   movements; wire into Notifications page where `costSpikes: []` is currently passed).
3. Variance attribution panel in Analytics: decompose margin drift into price inflation (cost deltas)
   vs waste (ww_waste_events cost) vs mix shift (order item mix) — the #1 "I know food cost is high,
   not why" pain. Clearly label derived/illustrative parts.
4. Flesh out thin tabs: recent-sales (filters, per-order margin), sales-hub (customer/product drill).
5. Add RoleGate around revenue/GP/net finance tiles; add useRealtimeRefresh(['pl_price_lists','pl_overrides','of_orders']).

## InsightGen (app/app/reportgen) — BIGGEST BUILD. Pains: rigid reporting, no raw export, daily brief
1. Create real `layout.tsx` (session guard + SubNav + provider) and routed tabs: `/` Overview,
   `/insights`, `/reports`, `/anomalies` — replace View.tsx's fake local-state tabs with real routes
   using the shared `SubNav` (bookmarkable, matching every other module).
2. Real cross-module aggregation server-side: compute insights from of_orders (sales), ww_waste_events
   (waste), sb_* (labour), pp_stock_items (stock) instead of read-only ig_insights seed. Kill
   hard-coded KPIs ("9 modules", "2m ago").
3. Daily Ops Brief (marketing promise): one server-rendered morning snapshot — yesterday's sales,
   waste logged, staff on shift today, stock alerts, open supplier risks.
4. Report builder: scope + module picker (types already exist), runs real queries, **CSV export**
   (raw-data-out pain — a download button per report/table).
5. Anomaly detection (rule-based, honest): food-cost variance vs target, supplier price jumps,
   labour % spikes, waste spikes; severity via existing GenInsight severity tones.

## ServiceDen (app/app/serviceden) — LIGHT TOUCH (private module)
1. Add useRealtimeRefresh(['sd_mail_messages','sd_leads','sd_lead_activities']) — inbox-shaped product.
2. Keep bespoke header (deliberate) but extract duplicated email-gate check into one helper.
3. Small polish only; no new tabs.

## ShiftBoard (app/app/shiftboard) — pains: swaps outside system, call-out chaos, OT surprises, labour cost per shift
1. Roster write path: create/edit/assign shifts (modal per cell), sb_roster_shifts insert/update;
   fix the RosterWeek label/openShifts read-off-first-row oddity in shiftboard-data.ts.
2. Swap & cover workflow: swap-request object (new additive `sb_shift_swaps` sql sibling) with
   propose → accept → manager-approve states, so the schedule of record is the app, not texts.
3. Call-out coverage: mark shift as call-out → generates an open-shift offer visible on LiveOps/
   Overview with eligible staff (skills/availability match) to contact.
4. OT-risk at scheduling time: warn in the roster editor when an assignment pushes projected hours
   past contracted/OT threshold (data already has contracted vs actual hours).
5. Labour cost per shift/day (marketing promise): rate × hours per shift, daily total + labour % vs
   sales (of_orders same-day revenue where present) on Insights.
6. Tips tab is OUT of scope this pass (noted for later). Add useRealtimeRefresh for LiveOps/Attendance.

## SupplySync (app/app/suppliers) — pains: price creep, credits chased manually, rebates leak, unmeasured performance
1. Price-change detection: alerts when a supplier's price for an item moves (ss_supplier_pricing
   history + invoice-derived prices via the Doc-U bridge) — surface on Overview + Pricing tab with
   old→new, %, annualised impact. Cross-supplier price comparison for equivalent items.
2. Credit & dispute tracker: log short-ship/substitution/quality issues against a supplier
   (new additive `ss_supplier_credits` sql sibling): claimed → acknowledged → credited/written-off,
   with amount owed rolled up on Overview ("R___ in unresolved credits").
3. Rebate tracker: build on SHIPPED supabase/rebates.sql — record agreements, expected vs received.
4. Performance tab: replace purely illustrative metrics with measured ones where data exists
   (late deliveries + issues from ss_supplier_history channels); keep "illustrative" label elsewhere.
5. Document expiry: surface expiring/expired supplier documents as actionable list (types exist).

## WasteWatch (app/app/wastelog) — pains: waste invisible in food cost, aggregates drift, no loop closure
1. Fix aggregate drift: recompute category cost/pct/trend from ww_waste_events at read time in
   wastewatch-data.ts (stored columns become fallback), so the donut always matches the log.
2. Waste-in-margin loop: "waste as % of food cost" derivation + weekly waste report card on Overview
   (top preventable causes, R value, trend) — the number PricePilot's variance panel consumes.
3. Reason-code insights on Analytics: over-portion by recipe (expectedQty vs qty is already modelled),
   employee coaching list framed constructively, day-of-week patterns.
4. Add useRealtimeRefresh(['ww_waste_events','ww_devices']); keep device-integration stub as-is.
