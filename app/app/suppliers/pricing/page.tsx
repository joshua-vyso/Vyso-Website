import { redirect } from 'next/navigation';

/** Redirect only: pricing intelligence split between the Market sheet and each supplier's profile; the Suppliers tab is the door to the latter (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/suppliers');
}
