import { redirect } from 'next/navigation';

/** Redirect only: the Products screen split across the new module's Stock and Market sheet tabs, so its old URL lands on the dashboard that links to both (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}
