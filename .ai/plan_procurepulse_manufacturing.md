# Plan: ProcurePulse — categorisation fix, Manufacturing (Recipes + Batches), chat-driven batch logging

**Date:** 2026-08-24
**Requested by Josh:** (1) fix "no products categorised" (963 TNS products, 100% Uncategorised); (2) Manufacturing nav tab replacing Recipes, with Recipes + Batches submenus; batch = pick recipe via typeahead, enter weights used, confirm → saved; (3) Finch chat on `gpt-5.6-luna` where "used butternut 0.6 kg and broc 1.0 kg. create a product entry using recipe mixed veg" logs a batch, fuzzy-matching to real TNS product names.

## Verified current state (recon 2026-08-24)

- Product master = `pp_stock_items` (`Vyso Platform/supabase/schema.sql:268-287`), has nullable `category text`. TNS seed (`supabase/seed-tns-products.sql`) never sets it.
- Categorisation feature EXISTS: `app/api/procurepulse/categorise/route.ts` (Claude Haiku via `categoriseProducts()` in `lib/ai/anthropic.ts`, 120 products/batch, uncategorised-only by default) + button in `components/platform/procurepulse/LiveStockView.tsx:72-97`. Dashboard grouping: `lib/platform/procurepulse.ts:368-432` (`CATEGORY_COLORS` includes a produce set: Fruit, Vegetables, Herbs, Salad & Leafy Greens, Mushrooms, Other).
- Recipes EXIST: `pp_recipes` / `pp_recipe_ingredients` (`supabase/pp-recipes.sql`), CRUD at `app/api/procurepulse/recipe/route.ts`, pages `app/app/procurepulse/recipes/{page.tsx,[id]/page.tsx}` + `RecipeEditor`. `pp_recipes.output_product` is FREE TEXT (no FK). Read-only planning helpers in `lib/platform/procurepulse.ts:246-366`.
- NO batches table/endpoint anywhere. `pp_movements` reason labels `recipe_reserved`/`recipe_consumed` already exist in the dashboard's `MOVEMENT_LABEL` map (`app/app/procurepulse/page.tsx:21-34`) but nothing writes them yet.
- Stock write pattern (copy exactly): insert `pp_movements` row (signed `change`, `reason`, `source_label`), then read `on_hand` → update to `max(0, current + change)`. Examples: `AddStockButton.tsx:142-156`, `adjustOnHand()` in `app/api/orderflow/order-stock/route.ts:94-127` (incl. graceful degradation when a CHECK value/column isn't applied yet).
- Fuzzy matching EXISTS, reuse don't rebuild: `lib/platform/procurepulse/matching.ts` (`normalizeName`, `diceCoefficient`), `lib/platform/docu/product-suggest.ts` (`scoreProductName`, `suggestProducts`), `lib/ai/finch/name-match.ts` (`matchByName`), learned aliases in `pp_name_aliases` (`supabase/pp-name-aliases.sql`).
- Finch agent: single streaming endpoint `app/api/ai/agent/route.ts`; Anthropic SDK (`lib/ai/finch/runtime.ts`); models in `lib/ai/finch/config.ts:67-68` (`AGENT_MODEL` haiku Q&A tier, `WORKFLOW_MODEL` sonnet workflow tier, env-overridable). Tools registry `lib/ai/finch/tools.ts` (`AgentTool { name, description, input_schema, workflow?, run(ctx) }`, `ToolContext` is RLS-scoped). Write pattern: tools NEVER write — they prepare a draft + `confirm_token`, route streams a `card` SSE event, the card's button POSTs to a separately-authenticated API route (`hubdoc_prepare_send` → `/api/integrations/hubdoc/send` is the canonical example, `tools.ts:283-319`, `route.ts:93-111,416-419`). Knowledge blocks in `lib/ai/finch/knowledge.ts`.
- `gpt-5.6-luna` is ALREADY used in this repo (Doc-U lane: `lib/ai/openai.ts:21`, `lib/ai/order-reader.ts:23-40`, `lib/ai/order-match-call.ts:49`). OpenAI quirks: tool calling best on Responses API; on chat-completions with function tools, `reasoning_effort` must be explicitly `"none"` or the API 400s.
- Conventions: migrations `supabase/pp-<feature>.sql`, idempotent (`create table if not exists`, `drop policy if exists` + org-scoped RLS via profiles join), routes degrade gracefully naming the migration file. Auth: `resolveUser(req)` (`lib/ai/auth.ts`) for `/api/procurepulse/*` + CORS `OPTIONS`. Tests: `tests/<area>-<feature>.test.ts`, `node:test` + `node:assert/strict`, relative imports WITH `.ts` extension (no `@/` alias).

---

## Phase A — Categorisation fix (independent, small)

**Goal:** all 963 TNS products get a sensible produce-wholesaler category; dashboard donut stops showing 100% Uncategorised.

1. Read `categoriseProducts()` in `lib/ai/anthropic.ts`. If its prompt taxonomy is the Meridian FMCG set (Field Produce / Prepared Lines / Dairy & Chilled / …), make the taxonomy fit a fresh-produce wholesaler: instruct the model to choose from **Fruit, Vegetables, Herbs, Salad & Leafy Greens, Mushrooms, Dried & Processed, Packaging, Other** (first five already have colors in `CATEGORY_COLORS`; add colors for any new name). Keep the endpoint's batching/auth untouched.
2. Create `scripts/categorise-tns.ts` (one-off, run locally with `npx tsx` or `node --experimental-strip-types`): loads env from `.env.local`, uses the SERVICE ROLE key if present (`SUPABASE_SERVICE_ROLE_KEY`) to fetch the TNS org's uncategorised `pp_stock_items` and run them through `categoriseProducts()` in batches of 120, writing `category` back. Print a per-category count summary. If no service key is available in `.env.local`, STOP and report — Josh will instead click "✦ Categorise 963" in ProcurePulse → Products after the taxonomy change deploys.
3. RUN the script (it's org-scoped data, idempotent, only fills NULL categories). Report the resulting category distribution.

**Acceptance:** `select category, count(*) from pp_stock_items where org_id = <TNS> group by 1` shows 0 (or near-0) NULL; taxonomy names match `CATEGORY_COLORS` keys.

## Phase B — Manufacturing: Batches (SQL + API + UI + nav)

**Goal:** Nav tab "Recipes" → "Manufacturing" with **Recipes** and **Batches** submenus. New batch: typeahead recipe picker → editable ingredient weights (prefilled from recipe) → Confirm → batch saved, ingredient stock decremented, output product stock incremented.

### B1. Migration `supabase/pp-batches.sql` (idempotent, house pattern)
- `alter table pp_recipes add column if not exists output_stock_item_id uuid references pp_stock_items(id) on delete set null;` — links a recipe's output to a real product. (Why: `output_product` is free text; the increment needs a real row.)
- `create table if not exists pp_batches (id uuid pk default gen_random_uuid(), org_id uuid not null references organisations(id) on delete cascade, recipe_id uuid references pp_recipes(id) on delete set null, recipe_name text not null, output_stock_item_id uuid references pp_stock_items(id) on delete set null, output_product text not null, output_qty numeric not null, output_unit text, notes text, source text not null default 'manual' check (source in ('manual','chat')), created_by uuid, created_at timestamptz default now())`.
- `create table if not exists pp_batch_ingredients (id uuid pk default gen_random_uuid(), org_id uuid not null, batch_id uuid not null references pp_batches(id) on delete cascade, stock_item_id uuid references pp_stock_items(id) on delete set null, product_name text not null, qty_used numeric not null, unit text)`.
- Indexes on `(org_id, created_at desc)` and `(batch_id)`; RLS enabled + org-scoped policies on both tables (copy the `pp-recipes.sql` policy shape verbatim).
- Check `pp_movements.reason` CHECK constraint in the base schema: if `'recipe_consumed'`/`'batch_produced'` are not allowed values, add a guarded `alter table ... drop constraint / add constraint` extending the list (idempotent), same approach as prior pp-*.sql files took for reasons. Add `'batch_produced'` to `MOVEMENT_LABEL` in `app/app/procurepulse/page.tsx` (label: "Produced from batch").

### B2. API `app/api/procurepulse/batch/route.ts`
- Auth via `resolveUser(req)` + CORS OPTIONS, same as `categorise/route.ts`. Graceful `friendly()` error naming `supabase/pp-batches.sql` if tables missing.
- `POST` body: `{ recipe_id, ingredients: [{ stock_item_id?, product_name, qty_used, unit? }], output?: { stock_item_id?, qty?, unit? }, notes?, source?: 'manual'|'chat' }`.
- Behaviour (mirror `adjustOnHand` pattern; all writes RLS-scoped):
  1. Load recipe (must belong to org). Resolve output stock item: `output.stock_item_id` → `recipe.output_stock_item_id` → fuzzy match `recipe.output_product` against org's `pp_stock_items` using `scoreProductName` (accept only a confident top match, threshold ≥ the module's literal-match tiers) → else CREATE a new `pp_stock_items` row (name = `output_product`, unit = `output_unit`, on_hand = 0) — Josh's "create a product entry" ask. If matched/created and `recipe.output_stock_item_id` was null, persist it back onto the recipe (learn the link).
  2. Insert `pp_batches` + `pp_batch_ingredients` rows.
  3. Per ingredient with a `stock_item_id`: insert `pp_movements` `{change: -qty_used, reason: 'recipe_consumed', source_label: 'Batch: <recipe_name>'}` and decrement `on_hand` (floor 0). Ingredients without a resolved stock item are recorded on the batch but move no stock.
  4. Output: insert `pp_movements` `{change: +output_qty, reason: 'batch_produced' (fallback 'received' if CHECK not applied — copy order-stock's degradation)}` and increment `on_hand`.
  5. Return `{ ok, batch_id, output: {stock_item_id, name, new_on_hand}, movements: n }`.
- `GET`: list recent batches for the org (for the Batches page), newest first, limit 50.

### B3. UI
- `app/app/procurepulse/layout.tsx`: rename the "Recipes" tab to **Manufacturing**, pointing at the existing `/app/procurepulse/recipes` route family. Inside, add a small sub-nav (two links: **Recipes** → existing `recipes/` pages untouched; **Batches** → new `recipes/batches/` page). Smallest-blast-radius: keep existing recipe routes/URLs working; batches lives beside them.
- New page `app/app/procurepulse/recipes/batches/page.tsx` + client component `components/platform/procurepulse/BatchLogger.tsx`:
  - Recipe picker: typeahead over the org's recipes (client-side filter is fine at current scale).
  - On pick: render one row per `pp_recipe_ingredients` line — product name, unit, qty input **prefilled with `qty_per_batch`**, editable. Output qty input prefilled with `recipe.output_qty`, editable. Notes optional.
  - Confirm button → `POST /api/procurepulse/batch` → success state showing output product + new on-hand; list of recent batches (from GET) below.
  - Match existing ProcurePulse component styling (see `AddStockButton.tsx`, `LiveStockView.tsx` for idiom).
- Add a "Log batch" button on the recipes list page header linking to the Batches page.

### B4. Tests `tests/pp-batches.test.ts`
Pure-logic tests (no network): output-resolution precedence (explicit → recipe FK → fuzzy → create), movement-delta computation for a batch payload, floor-at-zero decrement. Extract that logic into a pure helper `lib/platform/procurepulse/batch-logic.ts` so it's testable and shared by the route.

## Phase C — Chat-driven batch logging on `gpt-5.6-luna` (after B)

**Goal:** In Finch chat: "used butternut 0.6 kg and broc 1.0 kg. create a product entry using recipe mixed veg" → agent resolves recipe + ingredients against real TNS names, shows a confirm card, user clicks Confirm → same `POST /api/procurepulse/batch` (source `'chat'`).

### C1. Provider: OpenAI workflow tier
- `lib/ai/finch/config.ts`: add `WORKFLOW_PROVIDER = process.env.FINCH_WORKFLOW_PROVIDER || 'openai'` and default `WORKFLOW_MODEL` to `process.env.FINCH_WORKFLOW_MODEL || 'gpt-5.6-luna'` when provider is openai (keep the Anthropic path fully working behind `FINCH_WORKFLOW_PROVIDER=anthropic` — one env flip reverts). Q&A tier (`AGENT_MODEL`, Haiku) unchanged.
- `lib/ai/finch/runtime.ts` + `app/api/ai/agent/route.ts`: add an OpenAI-driven loop for the workflow tier using the existing OpenAI client setup from `lib/ai/openai.ts`. Use the **Responses API** for tool calling (repo already targets luna there; if the existing lane uses chat-completions, follow the repo's existing luna calling convention instead — and if chat-completions + function tools, set `reasoning_effort: 'none'` explicitly, else the API 400s). Map tool defs from the same `AgentTool[]` registry (JSON schema is shared); translate the streaming into the SAME SSE event shapes the client already consumes (`token`, `card`, `orderDraft`, done) so NO client changes are needed. This is the hardest piece — keep the Anthropic loop untouched and branch by provider.
- `.env.local`: `OPENAI_API_KEY` already present for the Doc-U lane (verify; if missing, report).

### C2. Tool `pp_prepare_batch_log` in `lib/ai/finch/tools.ts` (PROCUREPULSE_TOOLS, `workflow: true`)
- Input schema: `{ recipe_name: string, ingredients: [{ name: string, qty: number, unit?: string }], output_qty?: number, notes?: string }`.
- `run(ctx)`: read-only. Resolve recipe by name over the org's `pp_recipes` (normalizeName + scoreProductName tiering; if ambiguous return top candidates for the model to ask the user). Resolve each spoken ingredient ("broc") → org `pp_stock_items` via `pp_name_aliases` first, then `suggestProducts`/`scoreProductName`; include resolved real names + current on_hand in the draft. Resolve the output product exactly as B2 does (report whether it will match an existing product or create a new one — say which name). Return `{ ok, confirm_token, draft: { recipe_id, recipe_name, ingredients: [{stock_item_id, matched_name, qty, unit, on_hand}], unresolved: [...], output: {...} } }`.
- Route streams it as a `card` event (copy the `hubdoc_prepare_send` handling in `route.ts:93-111,416-419`); a new card component in the chat UI renders the draft (recipe, matched lines with "broc → Broccoli-Florets (kg)" style, output) with a Confirm button that POSTs the draft to `/api/procurepulse/batch` with `source:'chat'`. **A person presses; the model never writes** — keep the comment convention.
- Add a Manufacturing knowledge block to `lib/ai/finch/knowledge.ts` and the intent regex so batch-y phrasing (`used .* create .* recipe`, "log a batch", "made a batch of") triggers the workflow tier (see `lib/ai/finch/order-intent.ts` pattern).
- Tests `tests/finch-batch-tool.test.ts`: name-resolution behaviour with mocked catalogue ("broc" → "Broccoli", ambiguous names return candidates, unknown names land in `unresolved`).

## Constraints (all phases)
- Do not touch: Doc-U/OrderFlow lanes, `syncOrderFromDocument`, the Anthropic Q&A tier, TrialGate, module gating, mobile apps, demo-org SQL. Do not modify existing recipe CRUD contracts. Never write from inside an agent tool's `run()`. Match the house "why, not what" comment style.
- All new SQL idempotent + RLS'd per pp-*.sql convention; routes degrade gracefully naming the migration file.

## Verification (each phase)
```bash
npx tsc --noEmit
npm run lint
npm test
```
Manual (Josh): paste `supabase/pp-batches.sql`; log a batch in UI, confirm ingredient on_hand drops + output climbs and movements show "Used in recipe"/"Produced from batch"; in chat, run the butternut/broc sentence and confirm the card.

## Delegation
- Phase A → Sonnet (small, mechanical + one script run).
- Phase B → Sonnet (fully specified, follows existing patterns).
- Phase C → Opus (streaming-loop provider branch is intricate; one-shot beats retries). Runs after B merges; codes against B's route contract.
