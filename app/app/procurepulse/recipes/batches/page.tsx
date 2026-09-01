import { redirect } from 'next/navigation';

/** Redirect only: batches share the Manufacturing tab with the recipes they run (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/manufacturing');
}
