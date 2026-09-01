import { redirect } from 'next/navigation';

/** Redirect only: supplier credit notes are a section of the supplier profile on the Suppliers tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
