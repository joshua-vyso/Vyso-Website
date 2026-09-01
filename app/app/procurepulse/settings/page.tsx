import { redirect } from 'next/navigation';

/** Redirect only: the merged module keeps no settings screen of its own; thresholds are edited inline on the Stock tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
