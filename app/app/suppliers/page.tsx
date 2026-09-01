import { redirect } from 'next/navigation';

/** Redirect only: SupplySync's overview is the Suppliers tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
