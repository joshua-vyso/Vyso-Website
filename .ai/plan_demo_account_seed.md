# Plan — Ambiguous deep-demo account seed (demo@vyso.co.za), one SQL file (2026-07-29)

Architect: Fable 5. Implementers: Opus 5 subagents via Ultracode workflow.

## Goal & acceptance criteria
One SQL file, `supabase/demo-all-in-one.sql`, that seeds a complete demo workspace for
demo@vyso.co.za:
- Company identity deliberately AMBIGUOUS — reads equally as restaurant group, wholesaler,
  catering service, or farm/producer. Working identity: **"Meridian Food Co."** (Stellenbosch,
  Western Cape) — owns growing/production, supplies wholesale customers, runs catering/events,
  and operates a kitchen/counter. Product, customer, supplier and department names must stay
  segment-neutral (e.g. "prepared lines", "field produce", "trade customers", "events").
- Revenue ≈ **R5.5M/month** (natural variance R5.1–5.9M across seeded months). Suggested mix:
  wholesale/trade ~R3.2M, catering/events ~R1.1M, kitchen/counter ~R0.7M, farm-gate/produce ~R0.5M.
  Coherent economics: COGS ~60–64%, labour ~22–26% of revenue, waste ~1.5–2.5% of COGS.
  Cross-module numbers MUST reconcile (PricePilot revenue == OrderFlow invoiced+paid orders;
  PlanWise actuals derive from the same rows; WasteWatch feeds PricePilot variance).
- Depth: every module exercised, including the 29-07 features — supplier credits & rebates,
  shift swaps/cover, PlanWise decisions, InsightGen report runs + anomaly acks, price-change
  history rich enough to trigger cost-spike/creep + re-price alerts, OT-risk rosters,
  document-expiry rows, over-portioning waste events with expectedQty.
- ONE file, ordered: (0) bootstrap org+profile+org_features → (1) module schemas if missing
  (reuse existing demo-fresh-valley schema files by inclusion) → (2) seeds (delete-scoped-to-
  Meridian preamble, re-runnable) — mirroring demo-fresh-valley conventions exactly.
- ServiceDen: excluded (email-gated to Vyso's internal account, invisible to demo).

## Constraints
- demo@vyso.co.za currently maps to Fresh Valley Produce. The new bootstrap re-points the
  profile org_id (same `on conflict (id) do update` idiom). DO NOT delete Fresh Valley data.
- Auth user creation stays a documented dashboard prerequisite (already exists in live project).
- No app code changes. No edits to existing SQL files. New file(s) only.
- Fixed, deterministic UUIDs from a single blueprint so all domain sections cross-reference
  identically. Idempotent: seeds delete only Meridian-scoped rows first.
- Trial/tier: follow Fresh Valley (`tier 'scale'`); verify against computeTrial in
  lib/platform/supabase-server.ts so TrialGate never blocks the demo.

## Ordered steps (workflow)
1. Blueprint agent: read all schemas + fresh-valley seeds + data-layer code (what each module
   SELECTS — seeds must satisfy the queries, not just the DDL); emit complete blueprint JSON
  (org UUID, rosters: ~30 products w/ costs+prices, ~14 suppliers, ~28 customers, ~45 staff,
  8 departments, ~18 recipes, monthly P&L model, per-month order volumes).
2. Six domain writers in parallel, each producing one .sql fragment in scratch space, styled
   on the matching fresh-valley seed: (a) orderflow+core customers/orders/items/invoices,
   (b) procurepulse stock/recipes/movements + docu documents, (c) pricepilot lists/overrides/
   complaints + pl_targets, (d) shiftboard + swaps, (e) wastewatch + planwise(+decisions+goals),
   (f) supplysync(+credits+rebates) + insightgen(+runs+acks).
3. Assembler/verifier: concatenate in dependency order into supabase/demo-all-in-one.sql,
   statically verify: all FKs resolve to blueprint IDs, monthly revenue sums ≈5.5M (compute,
   don't trust), delete-preambles scoped to Meridian only, no ALTER/DROP of existing data
   except the org_features check-constraint idiom copied from 0-bootstrap.sql.

## Verification
- Assembler computes and prints revenue-by-month totals from the actual INSERT values.
- grep: no statement references Fresh Valley; every enum/status value exists in app constants.
