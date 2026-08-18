# Plan: Finch read tools P1.2 — price history, stock position, margin exposure (Phase D of the demo MVP)

Status: **approved by Josh 2026-08-18 ("go D")**. Architect: Fable. Implementer: one Opus agent on `main`.
Supersedes the unimplemented P1.2 slice of `.ai/plan_finch_read_tools.md`; P1.3 (Xero) stays out of scope.

Repo facts (verified this session): tool registry `lib/ai/finch/tools.ts` (`TOOLS_BY_MODULE`, Anthropic-format
`AgentTool` entries, `ToolContext{supabase (RLS), orgId, canSeeMoney, …}`), data fns per module
(`orderflow-data.ts`, `docu-data.ts`, `finch-suggestions-data.ts`), knowledge docs `lib/ai/finch/knowledge.ts`
(`BRIEF_KNOWLEDGE` documents `agent_findings` + the four agents), runtime `lib/ai/finch/runtime.ts`, route
`app/api/ai/agent/route.ts` (Haiku tier, `MAX_TURNS=5`, W4 module-aware, W5 attachments). Price series
helpers already exist: `lib/platform/price-watch/series.ts` (`seriesForFinding`, pure `shapeSeries`),
`lib/platform/agents/dedupe-keys.ts`; catalogue `pw_items` (name, base_unit), `pw_item_matches`
(raw_description → pw_item_id, status confirmed/auto/review), `pw_price_points` (supplier_id, line_supplier,
pw_item_id, document_id, line_index, unit_price, quantity_base, invoice_date). Stock: `pp_stock_items`
(on_hand stored, avg_unit_price, name, unit), `pp_stock_thresholds.low_threshold`, `pp_movements`
(change, reason, occurred_at); `lib/platform/stock-cover/detect.ts` has the pure days-of-cover / variance
maths and `lib/platform/procurepulse*` the status fn. Recipes: `pp_recipes` + `pp_recipe_ingredients`;
targets `pl_targets`; name matching `lib/ai/finch/name-match.ts`. Suppliers `suppliers(id,name)`.

## 1. Goal & acceptance
In a Brief chat (and the module bubble), on Meridian data, these answer correctly from live rows and cite what
they used — no invented numbers, and each answer says what it could not establish:
- Q2 "How has cooking oil moved this year, and who else supplies it?" → dated series R558→566→640→664 (Jun 8 →
  Aug 13), +19 % first→last, +10.1 % vs 60-day median, Riebeek Oils & Fats; other suppliers of the same
  `pw_item` if any (none → says so); mentions the Prepared Salad Mix drop only if asked about Cape Cold Chain.
- Q4 "What will I run out of this week?" → lines whose days-of-cover < 7 at last-30-day usage, on-hand vs
  threshold, e.g. Cooking Oil (4×5L case) 12 vs 16 (~12 d), Line Fish Fillet 0/20 (now), Baby Spinach, Bread
  Rolls, Fresh Milk; count-variance lines on request.
- "How is the oil increase hitting my margin?" → volume × Δprice per year from the series; if a recipe links the
  item, the recipes/lines it feeds and their `pl_targets` margin; otherwise "your recipes don't reference this
  line yet, so I can only size the cost, not the margin effect" — never a fabricated margin %.
- Money gate: price history and stock are operational (any member); **margin exposure and anything quoting
  revenue/targets is `canSeeMoney` only** (same rule as debtors).
- Every tool is registered on the `brief` module AND on `procurepulse` (stock) / `orderflow` (margin) so the
  bubble answers where the work is; knowledge docs teach when to call which and how to phrase evidence.

## 2. Tools (Anthropic tool schemas; names, inputs, outputs)
Data fns live in `lib/ai/finch/price-watch-data.ts` and `lib/ai/finch/procurepulse-data.ts` (RLS client from
`ToolContext`; every query `.eq('org_id')`; pure shaping fns exported for tests). Cap outputs (≤ 24 points,
≤ 12 lines) so Haiku's context stays small; return `{ok:false, reason}` shapes rather than throwing.

1. `pw_find_items` `{query: string}` → `[{pw_item_id, name, base_unit, suppliers:[{supplier_id, name,
   points, last_seen}]}]` (≤ 6) — resolves a spoken name ("cooking oil", "line fish") to catalogue items via
   `name-match.ts` over `pw_items.name` + `pw_item_matches.raw_description` (confirmed/auto only).
2. `pw_get_price_history` `{pw_item_id, supplier_id?, months?=6}` → per (supplier, line_supplier) series:
   `[{date, unit_price, quantity_base, document_id}]`, `base_unit`, `first/last/delta_pct`,
   `median_60d`, `delta_vs_median_pct`, `monthly_volume_estimate`, `evidence_document_ids` — reuse
   `shapeSeries`/the median maths from `series.ts` and `detect.ts` (import, don't re-implement).
3. `pp_get_stock_position` `{query?: string, only_at_risk?: boolean=false}` → `[{stock_item_id, name, unit,
   on_hand, low_threshold, consumption_30d, days_of_cover|null, status:'ok'|'low'|'out', variance_30d:{adjust,
   pct}|null}]` (≤ 12; when `only_at_risk` → days_of_cover < 7 or status≠ok, ranked by days_of_cover asc);
   maths imported from `stock-cover/detect.ts` (export the pure fns if they aren't already).
4. `pw_margin_exposure` `{pw_item_id, supplier_id?}` (`canSeeMoney`) → `{annual_cost_delta,
   monthly_volume_estimate, basis, recipes:[{recipe_id, name, uses_per_month|null, sale_price|null,
   target_margin_pct|null}], margin_effect: 'not_linked' | {…}}` — joins `pp_recipe_ingredients` to the
   stock item that the pw_item corresponds to (by name match `pw_items.name` ↔ `pp_stock_items.name`,
   threshold documented) and `pl_targets`; when no link → `margin_effect:'not_linked'` and the doc tells the
   model to say so.

Registration: `TOOLS_BY_MODULE.brief += [1,2,3,4]`, `procurepulse += [3]`, `orderflow += [4]` (money-gated),
`docu` unchanged. `TOOL_ACTIVITY` labels for the ✦ status lines ("Reading price history…", "Checking stock
cover…", "Sizing the margin effect…").

## 3. Knowledge (`lib/ai/finch/knowledge.ts`)
Add to `BRIEF_KNOWLEDGE` (and a short `PROCUREPULSE_KNOWLEDGE` if none exists): what a price series is (unit
price per base unit, per supplier), the 60-day-median rule and why "vs median" ≠ "first→last", how to cite
("3 invoices, 8 Jun–13 Aug"), the drafts-only rule (already), and the honesty rules: no margin % without a
recipe link; days of cover only when consumption > 0; say "I don't have X" rather than estimating.
Suggested follow-ups the model may offer: "show the invoices", "who else supplies it", "draft an email".

## 4. Files
Create: `lib/ai/finch/price-watch-data.ts`, `lib/ai/finch/procurepulse-data.ts`, tests
`tests/finch-price-watch-data.test.ts`, `tests/finch-procurepulse-data.test.ts` (pure shaping + gating).
Modify: `lib/ai/finch/tools.ts`, `lib/ai/finch/knowledge.ts`, `app/api/ai/agent/route.ts` (`TOOL_ACTIVITY`
only), `lib/platform/stock-cover/detect.ts` (export pure fns only if needed — no behaviour change; its tests
must stay green), `lib/platform/finch-suggestions.ts` (optional: a "how has {item} moved?" chip when a price
finding exists — only if trivial). `.ai/implementation.md` ("Finch read tools P1.2").
Do not touch: `lib/platform/price-watch/{normalize,match,detect,observe,run}.ts`, agents/crons, SQL,
shell/chat components, marketing.

## 5. Edge cases
No confirmed matches for a query → tool returns empty + `hint:"no priced lines match"`; item with one point →
series but no delta; multiple suppliers → one series each; `line_supplier` (market agents) grouped separately;
stock line with zero consumption → `days_of_cover:null`, status from threshold only; member asking margin →
tool not offered (not in their tool list) and knowledge tells the model to say it needs an admin; RLS-missing
tables (`pw_*` not migrated) → `{ok:false, reason:'not_available'}`.

## 6. Verification
Unit tests for shaping/gating; `npx tsc --noEmit`; `npm test`; `npm run build`; lint ≤ 50. Then a **live
rehearsal script** the implementer writes to `scripts/finch-rehearsal.md`: the four questions above with the
expected facts (from `supabase/demo-refresh-2026-08.sql`) for Josh/Fable to run in the Brief chat (W6). Commit
`finch: read tools — price history, stock position, margin exposure (P1.2)`.
