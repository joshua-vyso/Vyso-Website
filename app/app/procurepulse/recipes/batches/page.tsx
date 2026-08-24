import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { fetchStock, fetchRecipes, fetchRecipeIngredients } from '@/lib/platform/procurepulse-queries';
import { PageHead } from '@/components/platform/procurepulse/ui';
import { BatchLogger, type RecipeLite, type ItemLite } from '@/components/platform/procurepulse/BatchLogger';

/**
 * Log a Manufacturing batch: pick a recipe, adjust the weights actually used,
 * confirm — POSTs to /api/procurepulse/batch, which moves real stock
 * (ingredients down, output up). See BatchLogger for the form + confirm flow.
 */
export default async function BatchesPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [recipes, allIngredients, items] = await Promise.all([
    fetchRecipes(db, orgId),
    fetchRecipeIngredients(db, orgId),
    fetchStock(db, orgId),
  ]);

  const ingredientsByRecipe = new Map<string, typeof allIngredients>();
  for (const ing of allIngredients) {
    (ingredientsByRecipe.get(ing.recipe_id) ?? ingredientsByRecipe.set(ing.recipe_id, []).get(ing.recipe_id)!).push(ing);
  }

  const recipeLites: RecipeLite[] = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    output_product: r.output_product,
    output_qty: r.output_qty,
    output_unit: r.output_unit,
    ingredients: (ingredientsByRecipe.get(r.id) ?? []).map((i) => ({
      stock_item_id: i.stock_item_id,
      product_name: i.product_name,
      qty_per_batch: i.qty_per_batch,
      unit: i.unit,
    })),
  }));

  const itemLites: ItemLite[] = items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, on_hand: i.on_hand }));

  return (
    <div>
      <PageHead title="Batches" subtitle="Log a production run — pick a recipe, confirm the weights used, and stock moves automatically" />
      <div className="mt-5">
        <BatchLogger recipes={recipeLites} items={itemLites} />
      </div>
    </div>
  );
}
