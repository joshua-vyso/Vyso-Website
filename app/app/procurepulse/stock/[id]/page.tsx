import { redirect } from 'next/navigation';

/** Redirect only: there is no per-product screen in the new route map — the Stock tab carries the whole catalogue, searchable (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/levels');
}
