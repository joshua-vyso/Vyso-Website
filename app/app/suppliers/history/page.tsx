import { redirect } from 'next/navigation';

/** Redirect only: relationship history is a section of the supplier profile (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
