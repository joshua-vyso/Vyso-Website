import { redirect } from 'next/navigation';

/** Redirect only: recipes are the Manufacturing tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/manufacturing');
}
