import { redirect } from 'next/navigation';

/** Redirect only: low-stock alerting is the dashboard's low-stock card plus the Stock tab's badges now (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
