/**
 * Pure batch-logging logic for ProcurePulse Manufacturing — shared by
 * `/api/procurepulse/batch` (`route.ts`) and its tests. Framework- and
 * network-free on purpose: the two things that actually move money (which
 * product a batch's output lands on, and how much stock shifts by) should be
 * checkable without a database. The route does nothing more than fetch the
 * inputs these functions need and persist what they return.
 */

export interface OutputCandidate {
  id: string;
  name: string;
}

export type OutputResolution =
  | { kind: 'explicit' | 'linked' | 'fuzzy'; stockItemId: string; name: string; score?: number }
  | { kind: 'create'; name: string };

/**
 * Confidence floor for auto-accepting a fuzzy output match. Matches
 * `scoreProductName`'s substring tier (`docu/product-suggest.ts`) — anything
 * looser is a fuzzy/dice-coefficient guess, and posting a batch's output onto
 * the WRONG existing product (silently inflating someone else's stock) is a
 * worse failure than creating a duplicate a human can merge later.
 */
export const OUTPUT_FUZZY_ACCEPT = 0.85;

/**
 * Resolve which `pp_stock_items` row a batch's output lands on, in the
 * precedence the plan specifies: an explicit pick on the request beats the
 * recipe's learned link, which beats a confident fuzzy name match, which
 * beats creating a brand-new product. Each tier only fires when the one
 * before it produced nothing — a sure thing is never downgraded to a guess.
 */
export function resolveOutputProduct(args: {
  explicitStockItemId?: string | null;
  recipeOutputStockItemId?: string | null;
  outputProductName: string;
  catalogue: OutputCandidate[];
  scoreFn: (name: string, query: string) => number;
  acceptFloor?: number;
}): OutputResolution {
  const {
    explicitStockItemId,
    recipeOutputStockItemId,
    outputProductName,
    catalogue,
    scoreFn,
    acceptFloor = OUTPUT_FUZZY_ACCEPT,
  } = args;

  if (explicitStockItemId) {
    const hit = catalogue.find((c) => c.id === explicitStockItemId);
    return { kind: 'explicit', stockItemId: explicitStockItemId, name: hit?.name ?? outputProductName };
  }
  if (recipeOutputStockItemId) {
    const hit = catalogue.find((c) => c.id === recipeOutputStockItemId);
    return { kind: 'linked', stockItemId: recipeOutputStockItemId, name: hit?.name ?? outputProductName };
  }

  const name = outputProductName.trim();
  if (name) {
    let best: { item: OutputCandidate; score: number } | null = null;
    for (const item of catalogue) {
      const score = scoreFn(item.name, name);
      if (!best || score > best.score) best = { item, score };
    }
    if (best && best.score >= acceptFloor) {
      return { kind: 'fuzzy', stockItemId: best.item.id, name: best.item.name, score: best.score };
    }
  }
  return { kind: 'create', name: name || 'New product' };
}

/** Apply a signed delta to a current on_hand, floored at 0 — stock never goes negative. */
export function floorOnHand(current: number, delta: number): number {
  return Math.max(0, (Number(current) || 0) + delta);
}

export interface MovementDelta {
  stockItemId: string;
  /** Signed change to apply — negative for ingredient consumption, positive for output. */
  change: number;
  reason: string;
}

export interface BatchIngredientInput {
  stockItemId: string | null;
  qtyUsed: number;
}

/**
 * Movement rows a batch's ingredients need: one negative movement per
 * ingredient that resolves to a real stock item. Lines with no `stockItemId`
 * (or a non-positive `qtyUsed`) are dropped here — they're still recorded on
 * `pp_batch_ingredients` for the audit trail by the caller, they just move no
 * stock, per the plan's "recorded... but move no stock" rule for unresolved
 * lines.
 */
export function ingredientMovements(
  ingredients: BatchIngredientInput[],
  reason = 'recipe_consumed',
): MovementDelta[] {
  return ingredients
    .filter((i): i is BatchIngredientInput & { stockItemId: string } =>
      Boolean(i.stockItemId) && Number.isFinite(i.qtyUsed) && i.qtyUsed > 0,
    )
    .map((i) => ({ stockItemId: i.stockItemId, change: -Math.abs(i.qtyUsed), reason }));
}

/** The single positive movement for a batch's output (never negative, even on bad input). */
export function outputMovement(stockItemId: string, qty: number, reason = 'batch_produced'): MovementDelta {
  return { stockItemId, change: Math.max(0, Number(qty) || 0), reason };
}

// ---------------------------------------------------------------------------
// filterRecipes — the Batches page's recipe typeahead
// ---------------------------------------------------------------------------

/** The one field the picker filters on — kept minimal so any recipe shape works. */
export interface RecipeSearchable {
  name: string;
}

/**
 * Recipes to offer in the Batches page's picker. With no query, every one of
 * the org's recipes — focusing the field must show the full list immediately
 * (there may be only one, and "nothing appears until you type" is exactly the
 * dead-picker bug this replaces), not just an empty dropdown waiting for a
 * keystroke. With a query, a case-insensitive substring match on the name.
 * `max` caps the dropdown the same way it always did (scroll, not pagination).
 */
export function filterRecipes<T extends RecipeSearchable>(recipes: T[], query: string, max = 8): T[] {
  const q = query.trim().toLowerCase();
  const matches = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;
  return matches.slice(0, max);
}

// ---------------------------------------------------------------------------
// scaleRecipePrefill / appendBatchCountNote — the Batches page's "Batches"
// count. Josh's ask: set how many batches a run makes once, instead of the
// count only ever incrementing by one and having to retype the recipe each
// time. Persistence is unchanged — still one `pp_batches` row per confirm,
// just with quantities already multiplied by the count.
// ---------------------------------------------------------------------------

export interface RecipePrefillIngredient {
  stock_item_id: string | null;
  product_name: string;
  qty_per_batch: number;
  unit: string | null;
}

/** The subset of a recipe `scaleRecipePrefill` needs — matches RecipeLite's
 *  shape in BatchLogger.tsx without this framework-free module importing a
 *  client component's types. */
export interface RecipePrefillInput {
  output_qty: number | null;
  output_unit: string | null;
  ingredients: RecipePrefillIngredient[];
}

export interface ScaledIngredientRow {
  stock_item_id: string | null;
  product_name: string;
  /** Pre-stringified for the qty input, '' when the per-batch qty is 0/unset
   *  (the same "blank, not 0" convention the unscaled prefill already used). */
  qty_used: string;
  unit: string | null;
}

export interface ScaledRecipePrefill {
  rows: ScaledIngredientRow[];
  outputQty: string;
  outputUnit: string | null;
}

/** Round off float noise (0.1 * 3 === 0.30000000000000004) without claiming
 *  more precision than a stock qty ever needs. */
function roundQty(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Multiply a recipe's per-batch quantities by a batch count, for the
 * Batches page's "Batches" field. An invalid/non-positive count falls back
 * to 1 (the field's own default) rather than zeroing every prefill out from
 * under the user. Every field is recomputed wholesale on each call — the
 * plan's documented simplest-acceptable behaviour: a hand-edit made before
 * changing the count is expected to be re-entered after, not preserved.
 */
export function scaleRecipePrefill(recipe: RecipePrefillInput, count: number): ScaledRecipePrefill {
  const n = Number.isFinite(count) && count > 0 ? count : 1;
  return {
    rows: recipe.ingredients.map((ing) => ({
      stock_item_id: ing.stock_item_id,
      product_name: ing.product_name,
      qty_used: ing.qty_per_batch ? String(roundQty(ing.qty_per_batch * n)) : '',
      unit: ing.unit,
    })),
    outputQty: recipe.output_qty != null ? String(roundQty(recipe.output_qty * n)) : '',
    outputUnit: recipe.output_unit,
  };
}

/**
 * Append a "× N batches" marker to a batch's notes when N > 1 — the only
 * record of the multiplier in the audit trail, since a multi-batch confirm
 * still writes just the one `pp_batches` row (already-multiplied quantities,
 * no schema change). N <= 1 leaves notes untouched, matching prior behaviour.
 */
export function appendBatchCountNote(notes: string, count: number): string {
  const trimmed = notes.trim();
  if (!Number.isFinite(count) || count <= 1) return trimmed;
  const marker = `× ${count} batches`;
  return trimmed ? `${trimmed} (${marker})` : marker;
}
