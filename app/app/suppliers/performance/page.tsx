import { redirect } from 'next/navigation';

/** Redirect only: performance is a column and a profile section on the Suppliers tab, not a screen (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
