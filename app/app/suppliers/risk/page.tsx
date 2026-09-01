import { redirect } from 'next/navigation';

/** Redirect only: risk is a status on the supplier row, not a screen (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
