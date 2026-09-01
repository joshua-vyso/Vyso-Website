import { redirect } from 'next/navigation';

/** Redirect only: the intelligence screens folded into the dashboard's cards (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
