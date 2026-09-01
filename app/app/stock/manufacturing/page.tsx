import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import {
  fetchRecipeIngredients,
  fetchRecipes,
  fetchStock,
} from '@/lib/platform/procurepulse-queries';
import { fetchBatchIngredients, fetchBatches } from '@/lib/platform/stock-data';
import { computeRecipeKpis, maxRecipeBatches, rand } from '@/lib/platform/procurepulse';
import type { RecipeWithPlan } from '@/lib/platform/procurepulse';
import type { RecipeIngredient, StockItem } from '@/lib/platform/types';
import { Kpi, KpiStrip } from '@/components/platform/module-ui';
import {
  BatchesTable,
  RecipesTable,
  type BatchSummary,
  type RecipeSummary,
} from '@/components/platform/stock/ManufacturingView';
import { LogBatchForm, type BatchRecipeOption } from '@/components/platform/stock/LogBatchForm';

/**
 * Manufacturing — the products the warehouse makes rather than buys
 * (`.ai/plan_stock_suppliers_page.md`).
 *
 * Recipes and the batch log are read straight from the existing ProcurePulse
 * data layer (`fetchRecipes` / `fetchRecipeIngredients` / `fetchStock`) plus the
 * two batch fetchers added in `stock-data.ts` — ProcurePulse read its batches
 * from the client through `GET /api/procurepulse/batch`, which a server page
 * can't call. Availability maths is `maxRecipeBatches`, unchanged.
 */
export default async function ManufacturingPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, recipes, allIngredients, batches] = await Promise.all([
    fetchStock(db, orgId),
    fetchRecipes(db, orgId),
    fetchRecipeIngredients(db, orgId),
    fetchBatches(db, orgId, 50),
  ]);
  // Second hop, not part of the fan-out: it needs the batch ids the read above
  // returned, and scoping to them beats an unbounded org-wide ingredient read.
  const batchLines = await fetchBatchIngredients(db, orgId, batches.map((b) => b.id));

  const stockByItem = new Map<string, StockItem>(items.map((i) => [i.id, i]));
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>();
  for (const ing of allIngredients) {
    const arr = ingredientsByRecipe.get(ing.recipe_id) ?? [];
    arr.push(ing);
    ingredientsByRecipe.set(ing.recipe_id, arr);
  }

  const plans: RecipeWithPlan[] = recipes.map((recipe) => {
    const ings = ingredientsByRecipe.get(recipe.id) ?? [];
    return { recipe, plan: maxRecipeBatches(ings, stockByItem), ingredientCount: ings.length };
  });
  const kpis = computeRecipeKpis(plans, allIngredients);

  const recipeRows: RecipeSummary[] = plans.map(({ recipe, plan, ingredientCount }) => ({
    id: recipe.id,
    name: recipe.name,
    output: recipe.output_product
      ? `${recipe.output_product}${
          recipe.output_qty ? ` · ${recipe.output_qty}${recipe.output_unit ? ` ${recipe.output_unit}` : ''}` : ''
        }`
      : null,
    ingredientCount,
    batches: plan.batches,
    readiness: plan.readiness,
    limitingName: plan.limiting?.ingredient.product_name ?? null,
    costPerBatch: plan.costPerBatch,
  }));

  const linesByBatch = new Map<string, string[]>();
  for (const l of batchLines) {
    const arr = linesByBatch.get(l.batch_id) ?? [];
    arr.push(`${l.qty_used}${l.unit ? ` ${l.unit}` : ''} ${l.product_name}`);
    linesByBatch.set(l.batch_id, arr);
  }

  const batchRows: BatchSummary[] = batches.map((b) => ({
    id: b.id,
    when: new Date(b.created_at).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    recipeName: b.recipe_name,
    outputProduct: b.output_product,
    outputQty: b.output_qty,
    outputUnit: b.output_unit,
    used: (linesByBatch.get(b.id) ?? []).join(' · '),
    source: b.source,
  }));

  const options: BatchRecipeOption[] = plans.map(({ recipe, plan }) => ({
    id: recipe.id,
    name: recipe.name,
    outputProduct: recipe.output_product,
    outputQty: recipe.output_qty,
    outputUnit: recipe.output_unit,
    ingredients: (ingredientsByRecipe.get(recipe.id) ?? []).map((i) => ({
      stock_item_id: i.stock_item_id,
      product_name: i.product_name,
      qty_per_batch: i.qty_per_batch,
      unit: i.unit,
    })),
    possible: plan.batches,
  }));

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Recipes" value={String(kpis.activeRecipes)} sub="Products made in-house" />
        <Kpi
          label="Short on stock"
          value={String(kpis.blocked)}
          accent={kpis.blocked > 0 ? 'var(--tone-critical-fg)' : undefined}
          sub="Cannot be made right now"
        />
        <Kpi
          label="One batch each"
          value={rand(kpis.costOneBatchEach, { compact: true })}
          sub="Stock cost to make them all once"
        />
        <Kpi label="Batches logged" value={String(batches.length)} sub="Most recent 50" />
        <Kpi
          label="Most-used ingredient"
          value={kpis.mostUsedIngredient}
          sub={kpis.mostUsedCount > 0 ? `In ${kpis.mostUsedCount} recipe${kpis.mostUsedCount === 1 ? '' : 's'}` : undefined}
        />
      </KpiStrip>

      <LogBatchForm recipes={options} />
      <RecipesTable recipes={recipeRows} />
      <BatchesTable batches={batchRows} />
    </div>
  );
}
