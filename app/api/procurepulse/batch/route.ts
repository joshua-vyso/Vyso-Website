import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { scoreProductName } from '@/lib/platform/docu/product-suggest';
import {
  resolveOutputProduct,
  ingredientMovements,
  outputMovement,
  floorOnHand,
  type OutputCandidate,
} from '@/lib/platform/procurepulse/batch-logic';

// A batch write is several sequential inserts + reads (recipe, catalogue,
// batch header, ingredient lines, N movement writes) — give it more room than
// a single-table route, same reasoning as feed/categorise.
export const maxDuration = 30;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

function friendly(error: { code?: string; message?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (error?.code === '42P01' || (/pp_batch/.test(msg) && /exist/i.test(msg))) {
    return 'Manufacturing batches aren’t set up yet — run the pp-batches migration in Supabase.';
  }
  if (error?.code === '42703' && /output_stock_item_id/.test(msg)) {
    return 'Recipes aren’t linked to products yet — run the pp-batches migration in Supabase.';
  }
  return msg || 'Something went wrong.';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface IngredientIn {
  stock_item_id?: string | null;
  product_name?: string;
  qty_used?: number | string;
  unit?: string | null;
}

type DB = SupabaseClient;

/**
 * Insert one signed stock movement and reflect it onto on_hand, retrying with
 * a looser `reason` if the richer one is rejected (mirrors adjustOnHand /
 * order-stock's degradation — no CHECK constraint exists on pp_movements.reason
 * today, but this keeps a batch from failing outright if one is ever added).
 * Returns true iff a movement row actually landed.
 */
async function applyMovement(
  db: DB,
  orgId: string,
  stockItemId: string,
  change: number,
  reasons: string[],
  label: string,
): Promise<boolean> {
  if (change === 0) return false;
  let lastErr: { message?: string } | null = { message: 'no reasons given' };
  for (const reason of reasons) {
    ({ error: lastErr } = await db
      .from('pp_movements')
      .insert({ org_id: orgId, stock_item_id: stockItemId, change, reason, source_label: label }));
    if (!lastErr) break;
  }
  if (lastErr) return false;

  const { data: cur } = await db.from('pp_stock_items').select('on_hand').eq('id', stockItemId).maybeSingle();
  const next = floorOnHand(Number((cur as { on_hand?: number } | null)?.on_hand ?? 0), change);
  await db.from('pp_stock_items').update({ on_hand: next }).eq('id', stockItemId);
  return true;
}

/**
 * Log a Manufacturing batch: resolve/produce the output product, record the
 * batch + its ingredient lines, then move real stock — ingredients down,
 * output up. Body: { recipe_id, ingredients: [{ stock_item_id?, product_name,
 * qty_used, unit? }], output?: { stock_item_id?, qty?, unit? }, notes?,
 * source?: 'manual' | 'chat' }.
 *
 * `source: 'chat'` exists for Phase C (Finch): a tool DRAFTS a batch but never
 * writes — the card's Confirm button is what calls this route, same as every
 * other "a person presses, the model never writes" flow in this codebase.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  const { supabase, userId } = auth;

  // resolveUser only authenticates; org scope (and every insert's org_id) comes
  // from the caller's own profile row, which RLS restricts to their own —
  // exactly the app/api/ai/agent/route.ts pattern for an /api/ai-style route.
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle<{ org_id: string | null }>();
  const orgId = profile?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation for this account.' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const body = (await req.json().catch(() => ({}))) as {
    recipe_id?: string;
    ingredients?: IngredientIn[];
    output?: { stock_item_id?: string; qty?: number | string; unit?: string };
    notes?: string;
    source?: string;
  };

  const recipeId = str(body.recipe_id);
  if (!recipeId) {
    return NextResponse.json({ error: 'recipe_id is required.' }, { status: 400, headers: AI_CORS_HEADERS });
  }
  const ingredientsIn = Array.isArray(body.ingredients) ? body.ingredients : [];
  const source = body.source === 'chat' ? 'chat' : 'manual';

  const { data: recipeRow, error: recErr } = await supabase
    .from('pp_recipes')
    .select('id, name, output_product, output_qty, output_unit, output_stock_item_id')
    .eq('id', recipeId)
    .eq('org_id', orgId)
    .maybeSingle<{
      id: string;
      name: string;
      output_product: string | null;
      output_qty: number | null;
      output_unit: string | null;
      output_stock_item_id: string | null;
    }>();
  if (recErr) {
    return NextResponse.json({ error: friendly(recErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  if (!recipeRow) {
    return NextResponse.json({ error: 'Recipe not found.' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  // Output resolution: explicit request pick → recipe's learned link → a
  // confident fuzzy name match against the org's catalogue → else create a new
  // product. See batch-logic.ts for the precedence rules.
  const { data: catalogueRows } = await supabase.from('pp_stock_items').select('id, name').eq('org_id', orgId);
  const catalogue: OutputCandidate[] = ((catalogueRows ?? []) as { id: string; name: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
  }));
  const outputProductName = recipeRow.output_product?.trim() || recipeRow.name;
  const resolution = resolveOutputProduct({
    explicitStockItemId: str(body.output?.stock_item_id),
    recipeOutputStockItemId: recipeRow.output_stock_item_id,
    outputProductName,
    catalogue,
    scoreFn: scoreProductName,
  });

  let outputStockItemId: string;
  let outputName: string;
  if (resolution.kind === 'create') {
    const unit = str(body.output?.unit) ?? recipeRow.output_unit ?? 'units';
    const { data: created, error: createErr } = await supabase
      .from('pp_stock_items')
      .insert({ org_id: orgId, name: resolution.name, unit, on_hand: 0, low_threshold: 0, currency: 'ZAR' })
      .select('id')
      .single();
    if (createErr || !created) {
      return NextResponse.json({ error: friendly(createErr) }, { status: 500, headers: AI_CORS_HEADERS });
    }
    outputStockItemId = (created as { id: string }).id;
    outputName = resolution.name;
  } else {
    outputStockItemId = resolution.stockItemId;
    outputName = resolution.name;
  }

  // Learn the link: a recipe that had no output_stock_item_id now does, so the
  // NEXT batch of this recipe skips straight to the 'linked' tier instead of
  // re-matching (or re-creating a duplicate) every time.
  if (!recipeRow.output_stock_item_id) {
    await supabase.from('pp_recipes').update({ output_stock_item_id: outputStockItemId }).eq('id', recipeId).eq('org_id', orgId);
  }

  const outputQty = num(body.output?.qty) ?? recipeRow.output_qty ?? 0;
  const outputUnit = str(body.output?.unit) ?? recipeRow.output_unit;

  const { data: batchRow, error: batchErr } = await supabase
    .from('pp_batches')
    .insert({
      org_id: orgId,
      recipe_id: recipeId,
      recipe_name: recipeRow.name,
      output_stock_item_id: outputStockItemId,
      output_product: outputName,
      output_qty: outputQty,
      output_unit: outputUnit,
      notes: str(body.notes),
      source,
      created_by: userId,
    })
    .select('id')
    .single();
  if (batchErr || !batchRow) {
    return NextResponse.json({ error: friendly(batchErr) }, { status: 500, headers: AI_CORS_HEADERS });
  }
  const batchId = (batchRow as { id: string }).id;

  // Ingredient lines: every named line is recorded (audit trail of what was
  // actually used), even ones with no stock_item_id — those just move no stock
  // below.
  const ingredientRows = ingredientsIn
    .filter((i) => str(i.product_name))
    .map((i) => ({
      org_id: orgId,
      batch_id: batchId,
      stock_item_id: str(i.stock_item_id),
      product_name: str(i.product_name) as string,
      qty_used: Math.max(0, num(i.qty_used) ?? 0),
      unit: str(i.unit),
    }));
  if (ingredientRows.length > 0) {
    const { error: ingErr } = await supabase.from('pp_batch_ingredients').insert(ingredientRows);
    if (ingErr) {
      // The batch header already landed (it's the source of truth that a batch
      // happened); a failed ingredient-line insert shouldn't block the stock
      // movements below, so we surface it but keep going.
      console.error('pp_batch_ingredients insert failed', ingErr);
    }
  }

  // Stock movements — ingredients down, output up. Each insert tries the
  // preferred reason first and degrades if rejected (see applyMovement).
  const label = `Batch: ${recipeRow.name}`;
  const consumeDeltas = ingredientMovements(
    ingredientRows.map((r) => ({ stockItemId: r.stock_item_id, qtyUsed: r.qty_used })),
  );
  let movements = 0;
  for (const d of consumeDeltas) {
    const ok = await applyMovement(supabase, orgId, d.stockItemId, d.change, [d.reason, 'used'], label);
    if (ok) movements += 1;
  }

  const produce = outputMovement(outputStockItemId, outputQty);
  if (produce.change > 0) {
    const ok = await applyMovement(supabase, orgId, produce.stockItemId, produce.change, [produce.reason, 'received'], label);
    if (ok) movements += 1;
  }

  const { data: finalOutput } = await supabase
    .from('pp_stock_items')
    .select('on_hand')
    .eq('id', outputStockItemId)
    .maybeSingle();

  return NextResponse.json(
    {
      ok: true,
      batch_id: batchId,
      output: {
        stock_item_id: outputStockItemId,
        name: outputName,
        new_on_hand: Number((finalOutput as { on_hand?: number } | null)?.on_hand ?? 0),
      },
      movements,
    },
    { headers: AI_CORS_HEADERS },
  );
}

/** Recent batches for the org, newest first — feeds the Batches page list. */
export async function GET(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  const { supabase, userId } = auth;

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle<{ org_id: string | null }>();
  const orgId = profile?.org_id ?? null;
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation for this account.' }, { status: 401, headers: AI_CORS_HEADERS });
  }

  const { data, error } = await supabase
    .from('pp_batches')
    .select('id, recipe_id, recipe_name, output_product, output_qty, output_unit, notes, source, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: friendly(error) }, { status: 500, headers: AI_CORS_HEADERS });
  }

  return NextResponse.json({ ok: true, batches: data ?? [] }, { headers: AI_CORS_HEADERS });
}
