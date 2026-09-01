import { redirect } from 'next/navigation';

/** Redirect only: the recipe editor has no route of its own in the new map; Manufacturing lists recipes and their ingredients (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/manufacturing');
}
