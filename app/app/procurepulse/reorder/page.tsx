import { redirect } from 'next/navigation';

/** Redirect only: Stock orders has no tab of its own in the new route map — the dashboard is where reordering is decided from now (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
