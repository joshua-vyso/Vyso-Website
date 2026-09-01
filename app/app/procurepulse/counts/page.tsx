import { redirect } from 'next/navigation';

/** Redirect only: stock counts are explicitly out of scope for the merged module's first pass, so this lands on the dashboard rather than a screen that cannot count (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
