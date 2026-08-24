/**
 * "Used butternut 0.6 kg and broc 1.0 kg — create a product entry using recipe
 * mixed veg." — turning that sentence into a batch a person can confirm
 * (Manufacturing C2).
 *
 * NOTHING HERE WRITES. This is the read half of the platform's oldest rule:
 * the tool resolves what was MEANT — which recipe, which real products, which
 * output line — and hands back a draft plus a token. The card's Confirm button
 * is what POSTs to `/api/procurepulse/batch`, with the same auth, the same RLS
 * and the same movement code the Batches screen uses. A person presses; the
 * model never writes.
 *
 * WHY THE MATCHING LIVES IN PURE FUNCTIONS. "broc" → "Broccoli-Florets (kg)" is
 * the entire feature, and it is also the thing that quietly decommissions a kg
 * of the wrong product if it is wrong. So the resolution rules are separated
 * from the queries around them and tested against a fixed catalogue
 * (tests/finch-batch-tool.test.ts) — no database, no network, no model.
 *
 * WHAT IT MATCHES AGAINST, IN ORDER. A confirmed `pp_name_aliases` row first —
 * that is a HUMAN who has already ruled that this messy name is that product,
 * and a ruling outranks a score. Then `scoreProductName` over the org's
 * catalogue, on the same tiering Doc-U's typeahead uses, so the name Finch
 * matches is the name the review screen would have offered.
 *
 * THREE OUTCOMES, NOT TWO. Matched, ambiguous, unresolved. Ambiguity is not a
 * failure to be resolved by picking the first row: "broc" against both
 * "Broccoli" and "Broccoli Florets" is a question, and the tool returns the
 * candidates so the MODEL can ask it. Silently picking one is how a batch
 * decrements a line nobody used.
 *
 * NO `server-only` / `@/` ALIAS — see the header of price-watch-data.ts. This
 * module is loaded directly by node --test, which strips types but resolves
 * neither extensionless ESM specifiers nor the alias.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreProductName } from '../../platform/docu/product-suggest.ts';
import { normalizeName } from '../../platform/procurepulse/matching.ts';
import { resolveOutputProduct, type OutputCandidate } from '../../platform/procurepulse/batch-logic.ts';

type Db = SupabaseClient;

/* ── The rules ─────────────────────────────────────────────────────────────── */

/**
 * Confidence floor for accepting a spoken name as a real product.
 *
 * 0.85 is `scoreProductName`'s SUBSTRING tier: exact, normalised-equal, prefix,
 * word-prefix and substring all clear it, and every dice/fuzzy guess is scored
 * strictly beneath it (product-suggest.ts multiplies the fuzzy band by 0.8 for
 * exactly this reason). Deliberately the same floor `batch-logic.ts` uses for a
 * batch's OUTPUT product: the two decisions have the same consequence — stock
 * moving on a line the owner did not name.
 */
export const NAME_ACCEPT = 0.85;

/**
 * How far ahead the best match must be before it is taken as THE match.
 *
 * Within this margin, two names are equally good answers to what was said, and
 * the honest move is to ask. Small on purpose: it is a tie-breaker, not a
 * confidence threshold — the floor above is what decides whether anything is
 * plausible at all.
 */
export const TIE_MARGIN = 0.04;

/** A score at or above this is a literal identity (exact, or equal once
 *  normalised) and wins outright — "butternut" means Butternut even when
 *  "Butternut Cubes" scores well too. */
const CERTAIN = 0.98;

/** How many candidates an ambiguous result offers the model to ask about. More
 *  than a handful is a list, and a question with a list in it is not a question. */
export const CANDIDATE_LIMIT = 4;

export type NameResolution<T> =
  | { kind: 'matched'; item: T; score: number; via: 'alias' | 'name' }
  | { kind: 'ambiguous'; candidates: T[] }
  | { kind: 'unresolved' };

/**
 * Resolve one spoken name against a list of rows, by name only.
 *
 * PURE, and the only place the accept/tie rules are applied — recipes and
 * products both come through here so "which recipe did they mean?" and "which
 * product did they mean?" cannot answer with different levels of caution.
 */
export function resolveByName<T>(
  rows: readonly T[],
  query: string,
  nameOf: (row: T) => string,
): NameResolution<T> {
  const wanted = (query ?? '').trim();
  if (!wanted) return { kind: 'unresolved' };

  const scored = rows
    .map((row) => ({ row, score: scoreProductName(nameOf(row), wanted) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || nameOf(a.row).length - nameOf(b.row).length);

  const best = scored[0];
  if (!best || best.score < NAME_ACCEPT) return { kind: 'unresolved' };

  const runnerUp = scored[1]?.score ?? 0;
  // A literal identity beats anything that merely scores near it.
  if (best.score >= CERTAIN && best.score > runnerUp) {
    return { kind: 'matched', item: best.row, score: best.score, via: 'name' };
  }
  if (runnerUp < best.score - TIE_MARGIN) {
    return { kind: 'matched', item: best.row, score: best.score, via: 'name' };
  }
  return {
    kind: 'ambiguous',
    candidates: scored.slice(0, CANDIDATE_LIMIT).map((s) => s.row),
  };
}

/* ── The rows these rules run over ─────────────────────────────────────────── */

export interface RecipeRow {
  id: string;
  name: string;
  output_product: string | null;
  output_qty: number | null;
  output_unit: string | null;
  output_stock_item_id: string | null;
}

export interface CatalogueRow {
  id: string;
  name: string;
  unit: string | null;
  on_hand: number;
}

/** A human's confirmed ruling that a raw name IS a given product. */
export interface AliasRow {
  raw_name: string;
  stock_item_id: string | null;
  status: string;
}

/** One ingredient as the model heard it. */
export interface SpokenIngredient {
  name: string;
  qty: number;
  unit?: string | null;
}

/**
 * Resolve a spoken ingredient to a real catalogue line.
 *
 * ALIASES FIRST, AND THEY ARE NOT SCORED. A `pp_name_aliases` row is a person
 * who has already answered this exact question on the Doc-U review screen;
 * re-deriving it from string similarity would mean the platform can forget a
 * ruling it was explicitly given. Only `confirmed` rows that still point at a
 * live catalogue line count — a dismissed name means "never suggest this", and
 * an alias whose product has since been deleted resolves to nothing.
 */
export function resolveIngredient(
  catalogue: readonly CatalogueRow[],
  aliases: readonly AliasRow[],
  spokenName: string,
): NameResolution<CatalogueRow> {
  const wanted = (spokenName ?? '').trim();
  if (!wanted) return { kind: 'unresolved' };

  const key = normalizeName(wanted);
  for (const alias of aliases) {
    if (alias.status !== 'confirmed' || !alias.stock_item_id) continue;
    if (normalizeName(alias.raw_name) !== key) continue;
    const item = catalogue.find((c) => c.id === alias.stock_item_id);
    if (item) return { kind: 'matched', item, score: 1, via: 'alias' };
  }

  return resolveByName(catalogue, wanted, (c) => c.name);
}

/** Resolve a spoken recipe name over the org's recipes. */
export function resolveRecipe(recipes: readonly RecipeRow[], spokenName: string): NameResolution<RecipeRow> {
  return resolveByName(recipes, spokenName, (r) => r.name);
}

/* ── The draft the card draws ──────────────────────────────────────────────── */

/** A matched line: what was said, what it is, and what is on the shelf. */
export interface DraftLine {
  stock_item_id: string;
  /** The owner's own word for it — the card shows "broc → Broccoli Florets". */
  spoken_name: string;
  matched_name: string;
  qty: number;
  unit: string | null;
  on_hand: number;
  /** How it was matched: a human's earlier ruling, or the name score. */
  via: 'alias' | 'name';
}

/** A name that could be two products. The MODEL asks; nothing is guessed. */
export interface DraftAmbiguity {
  spoken_name: string;
  qty: number;
  unit: string | null;
  candidates: { stock_item_id: string; name: string; unit: string | null; on_hand: number }[];
}

/** A name that matches nothing. Recorded on the batch for the audit trail, but
 *  it moves no stock — the same rule the manual route applies (batch-logic.ts). */
export interface DraftUnresolved {
  spoken_name: string;
  qty: number;
  unit: string | null;
}

export interface DraftOutput {
  /** Null when this batch will CREATE the product ("create a product entry"). */
  stock_item_id: string | null;
  name: string;
  qty: number;
  unit: string | null;
  /** 'existing' → stock is added to a line that already exists; 'create' → a
   *  new `pp_stock_items` row is made by the confirm route. Said out loud on
   *  the card because they are very different things to press a button on. */
  action: 'existing' | 'create';
  /** What is on hand today, when there is a line to read it from. */
  on_hand: number | null;
}

export interface BatchDraft {
  recipe_id: string;
  recipe_name: string;
  ingredients: DraftLine[];
  ambiguous: DraftAmbiguity[];
  unresolved: DraftUnresolved[];
  output: DraftOutput;
  notes: string | null;
}

export type BatchPrepareResult =
  | {
      ok: false;
      reason: string;
      /** Present when the recipe name was the problem and there is something to
       *  ask about — the model names these back to the user. */
      recipe_candidates?: { id: string; name: string }[];
    }
  | {
      ok: true;
      /** Identifies THIS prepared batch, so a second one in the same
       *  conversation is a second card rather than an overwrite. The confirm
       *  route neither needs nor trusts it — it re-checks the recipe and every
       *  id against the session's own org. */
      confirm_token: string;
      draft: BatchDraft;
    };

/** The refusals this tool can answer with, word for word. The model is
 *  instructed to repeat them rather than paraphrase: each one names where the
 *  owner fixes it, which a paraphrase is exactly what loses. */
export const BATCH_REFUSALS = {
  noRecipeName: 'I need the recipe name — which recipe was this batch made from?',
  noRecipes: 'There are no recipes set up yet. Add one under ProcurePulse → Manufacturing → Recipes first.',
  recipeNotFound: (name: string) =>
    `I couldn't find a recipe called "${name}". Check the name under ProcurePulse → Manufacturing → Recipes.`,
  recipeAmbiguous: 'More than one recipe matches that name — which one did you mean?',
  notAvailable: 'Manufacturing isn’t set up in this database yet — run the pp-batches migration in Supabase.',
  noIngredients: 'I need to know what went into the batch — which products, and how much of each?',
} as const;

const CATALOGUE_READ_LIMIT = 2000;

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Read what is needed and draft the batch. NEVER WRITES.
 *
 * The output product follows `resolveOutputProduct` — the SAME precedence the
 * confirm route will apply a moment later (explicit → the recipe's learned link
 * → a confident name match → create). It is re-derived here only so the card
 * can say which of those is about to happen; the route re-runs it for real,
 * against the catalogue as it is at confirm time, and its answer is the one
 * that counts.
 */
export async function prepareBatchLog(
  db: Db,
  orgId: string,
  input: {
    recipeName?: string | null;
    ingredients?: SpokenIngredient[];
    outputQty?: number | null;
    notes?: string | null;
  },
): Promise<BatchPrepareResult> {
  if (!orgId) return { ok: false, reason: BATCH_REFUSALS.notAvailable };
  const recipeName = (input.recipeName ?? '').trim();
  if (!recipeName) return { ok: false, reason: BATCH_REFUSALS.noRecipeName };

  const { data: recipeRows, error: recipeError } = await db
    .from('pp_recipes')
    .select('id, name, output_product, output_qty, output_unit, output_stock_item_id')
    .eq('org_id', orgId)
    .limit(500)
    .returns<RecipeRow[]>();
  if (recipeError) {
    // `output_stock_item_id` is a pp-batches column, so this read fails on a
    // database where only the recipes migration has been pasted — a missing
    // COLUMN, not a missing table, which is why `isMissingRelation` alone
    // wouldn't catch it. Either fault has the same fix and the same sentence.
    return { ok: false, reason: BATCH_REFUSALS.notAvailable };
  }
  const recipes = recipeRows ?? [];
  if (recipes.length === 0) return { ok: false, reason: BATCH_REFUSALS.noRecipes };

  const found = resolveRecipe(recipes, recipeName);
  if (found.kind === 'unresolved') {
    return { ok: false, reason: BATCH_REFUSALS.recipeNotFound(recipeName) };
  }
  if (found.kind === 'ambiguous') {
    return {
      ok: false,
      reason: BATCH_REFUSALS.recipeAmbiguous,
      recipe_candidates: found.candidates.map((r) => ({ id: r.id, name: r.name })),
    };
  }
  const recipe = found.item;

  const { data: catalogueRows, error: catalogueError } = await db
    .from('pp_stock_items')
    .select('id, name, unit, on_hand')
    .eq('org_id', orgId)
    .limit(CATALOGUE_READ_LIMIT)
    .returns<Array<{ id: string; name: string | null; unit: string | null; on_hand: number | string | null }>>();
  if (catalogueError) return { ok: false, reason: BATCH_REFUSALS.notAvailable };
  const catalogue: CatalogueRow[] = (catalogueRows ?? [])
    .filter((r) => !!r.name)
    .map((r) => ({ id: r.id, name: r.name as string, unit: r.unit, on_hand: num(r.on_hand) }));

  // Soft: pp_name_aliases is its own migration, and its absence means there are
  // no learned rulings yet — not that the batch cannot be drafted.
  const { data: aliasRows } = await db
    .from('pp_name_aliases')
    .select('raw_name, stock_item_id, status')
    .eq('org_id', orgId)
    .limit(CATALOGUE_READ_LIMIT)
    .returns<AliasRow[]>();
  const aliases = aliasRows ?? [];

  /* What went in. The owner's own list wins; when they name only the recipe
   * ("log a batch of mixed veg"), the recipe's own lines at their per-batch
   * quantities are the honest default — it is what the Batches screen prefills,
   * and the card shows every figure before anything moves. */
  let spoken = (input.ingredients ?? []).filter((i) => (i?.name ?? '').trim() && Number(i.qty) > 0);
  if (spoken.length === 0) {
    const { data: lineRows } = await db
      .from('pp_recipe_ingredients')
      .select('product_name, qty_per_batch, unit, stock_item_id')
      .eq('recipe_id', recipe.id)
      .eq('org_id', orgId)
      .returns<Array<{ product_name: string; qty_per_batch: number | string | null; unit: string | null }>>();
    spoken = (lineRows ?? [])
      .filter((r) => r.product_name && num(r.qty_per_batch) > 0)
      .map((r) => ({ name: r.product_name, qty: num(r.qty_per_batch), unit: r.unit }));
  }
  if (spoken.length === 0) return { ok: false, reason: BATCH_REFUSALS.noIngredients };

  const ingredients: DraftLine[] = [];
  const ambiguous: DraftAmbiguity[] = [];
  const unresolved: DraftUnresolved[] = [];
  for (const line of spoken) {
    const name = line.name.trim();
    const qty = Number(line.qty);
    const unit = line.unit != null ? String(line.unit).trim() || null : null;
    const hit = resolveIngredient(catalogue, aliases, name);
    if (hit.kind === 'matched') {
      ingredients.push({
        stock_item_id: hit.item.id,
        spoken_name: name,
        matched_name: hit.item.name,
        qty,
        // The owner's unit when they gave one, otherwise the product's own —
        // "0.6" of something has to be 0.6 of a stated thing.
        unit: unit ?? hit.item.unit,
        on_hand: hit.item.on_hand,
        via: hit.via,
      });
    } else if (hit.kind === 'ambiguous') {
      ambiguous.push({
        spoken_name: name,
        qty,
        unit,
        candidates: hit.candidates.map((c) => ({
          stock_item_id: c.id,
          name: c.name,
          unit: c.unit,
          on_hand: c.on_hand,
        })),
      });
    } else {
      unresolved.push({ spoken_name: name, qty, unit });
    }
  }

  const outputName = recipe.output_product?.trim() || recipe.name;
  const resolution = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: recipe.output_stock_item_id,
    outputProductName: outputName,
    catalogue: catalogue.map((c): OutputCandidate => ({ id: c.id, name: c.name })),
    scoreFn: scoreProductName,
  });
  const outputItem =
    resolution.kind === 'create' ? null : catalogue.find((c) => c.id === resolution.stockItemId) ?? null;

  const output: DraftOutput = {
    stock_item_id: resolution.kind === 'create' ? null : resolution.stockItemId,
    name: resolution.name,
    qty: Number(input.outputQty ?? recipe.output_qty ?? 0) || 0,
    unit: outputItem?.unit ?? recipe.output_unit,
    action: resolution.kind === 'create' ? 'create' : 'existing',
    on_hand: outputItem?.on_hand ?? null,
  };

  return {
    ok: true,
    confirm_token: crypto.randomUUID(),
    draft: {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      ingredients,
      ambiguous,
      unresolved,
      output,
      notes: (input.notes ?? '').trim() || null,
    },
  };
}
