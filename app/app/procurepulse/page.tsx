import { redirect } from 'next/navigation';

/** Redirect only: ProcurePulse's dashboard is now the Stock & Suppliers dashboard (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
