import { redirect } from 'next/navigation';

/** Redirect only: the supplier list is the Suppliers tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
